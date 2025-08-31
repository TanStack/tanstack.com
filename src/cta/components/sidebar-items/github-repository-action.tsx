import { useState, useCallback, useEffect } from 'react'
import { useLocation } from '@tanstack/react-router'
import { FaGithub } from 'react-icons/fa'
import { authClient } from '~/utils/auth.client'
import { Button } from '../ui/button'
import { useDryRun, useProjectOptions } from '../../store/project'

// Helper function to force push all files using Git Data API
const forcePushAllFiles = async (
  token: string,
  owner: string,
  repo: string,
  branch: string,
  files: Record<string, string>
): Promise<any> => {
  // Step 1: Create blobs for all files in parallel batches
  const blobs: Array<{ path: string; sha: string }> = []
  const entries = Object.entries(files)
  const BATCH_SIZE = 4

  // Process in batches of 4 for parallelization
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE)

    const batchPromises = batch.map(async ([path, content]) => {
      // Clean path: remove leading ./ or /
      const cleanPath = path.replace(/^\.\//, '').replace(/^\//, '')

      const blobResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/blobs`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: content,
            encoding: 'utf-8',
          }),
        }
      )

      if (!blobResponse.ok) {
        const error = await blobResponse.json()
        throw new Error(
          `Failed to create blob for ${cleanPath}: ${error.message}`
        )
      }

      const blobData = await blobResponse.json()
      return { path: cleanPath, sha: blobData.sha }
    })

    // Wait for this batch to complete before starting the next
    const batchResults = await Promise.all(batchPromises)
    blobs.push(...batchResults)

    console.log(`Created blobs: ${blobs.length}/${entries.length}`)
  }

  // Step 2: Create a new tree with ONLY our files (ignoring everything else)
  const treeResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tree: blobs.map(({ path, sha }) => ({
          path,
          mode: '100644',
          type: 'blob',
          sha,
        })),
        // NO base_tree - this creates a completely new tree with only our files
      }),
    }
  )

  if (!treeResponse.ok) {
    throw new Error('Failed to create tree')
  }

  const treeData = await treeResponse.json()

  // Step 3: Get current commit to use as parent
  const headResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )

  if (!headResponse.ok) {
    throw new Error('Failed to get HEAD reference')
  }

  const headData = await headResponse.json()
  const parentSha = headData.object.sha

  // Step 4: Create commit with new tree
  const commitResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/commits`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Add TanStack Builder files',
        tree: treeData.sha,
        parents: [parentSha], // Include parent for history
      }),
    }
  )

  if (!commitResponse.ok) {
    const errorData = await commitResponse.json()
    console.error('Commit creation failed:', errorData)
    throw new Error(
      `Failed to create commit: ${errorData.message || commitResponse.status}`
    )
  }

  const commitData = await commitResponse.json()

  // Step 5: Force update the branch reference to point to new commit
  const updateRefResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sha: commitData.sha,
        force: true, // FORCE PUSH
      }),
    }
  )

  if (!updateRefResponse.ok) {
    throw new Error('Failed to update branch reference')
  }

  return {
    sha: commitData.sha,
    url: `https://github.com/${owner}/${repo}/commit/${commitData.sha}`,
  }
}

export function GitHubRepositoryAction() {
  const dryRun = useDryRun()
  const [performingAction, setPerformingAction] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const createRepository = useLocation().searchStr.includes('createRepository')
  const [createRepoButtonText, setCreateRepoButtonText] = useState(
    createRepository ? 'Creating new repo...' : 'Create Repository'
  )
  const projectOptions = useProjectOptions()

  const createGithubRepository = useCallback(async () => {
    if (performingAction) return
    setError(null)

    setPerformingAction(true)
    setCreateRepoButtonText('Creating new repository...')
    try {
      if (!projectOptions?.projectName) {
        setError('No project name found')
        return
      }

      const { data, error } = await authClient.getAccessToken({
        providerId: 'github',
      })
      if (error) {
        console.error(error)
        setError('Failed to get access token')
        return
      }

      const response = await fetch(`https://api.github.com/user/repos`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${data?.accessToken}`,
        },
        body: JSON.stringify({
          name: projectOptions?.projectName,
          private: true,
          auto_init: true, // Must be true to use createCommitOnBranch
        }),
      })

      const responseData = await response.json()

      if (!response.ok) {
        if (response.status === 404) {
          // This is the status we get when the user does not have proper scopes
          await authClient.linkSocial({
            provider: 'github',
            callbackURL: '/builder?createRepository=true',
            scopes: ['user:email', 'repo'],
          })

          return
        }

        throw new Error(responseData.errors[0].message)
      }

      // Repository created successfully, now commit the add-on files
      setCreateRepoButtonText('Committing files...')

      // Get the owner from the repository data
      const owner = responseData.owner.login
      const repoName = responseData.name

      // Wait for GitHub to fully initialize the repository with auto_init
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Commit the dry run files to the repository
      if (dryRun && dryRun.files && Object.keys(dryRun.files).length > 0) {
        try {
          const commitResult = await forcePushAllFiles(
            data?.accessToken!,
            owner,
            repoName,
            responseData.default_branch || 'main',
            dryRun.files
          )
          console.log('Files force pushed successfully:', commitResult)
          setCreateRepoButtonText('Repository created!')

          // Open the repository in a new tab
          window.open(responseData.html_url, '_blank')
        } catch (commitError) {
          console.error('Error committing files:', commitError)
          setError(
            `Repository created but failed to commit files: ${
              (commitError as Error).message
            }`
          )
          setCreateRepoButtonText('Create Repository')
          // Still open the repo even if file commit failed
          window.open(responseData.html_url, '_blank')
        }
      } else {
        // No files to commit, just open the repository
        setCreateRepoButtonText('Repository created!')
        window.open(responseData.html_url, '_blank')
      }

      return responseData
    } catch (error) {
      console.error(error)
      setError(`Failed to create repository: ${(error as Error).message}`)
    } finally {
      setPerformingAction(false)
      setCreateRepoButtonText('Create Repository')
    }
  }, [performingAction, projectOptions?.projectName, dryRun])

  useEffect(() => {
    if (createRepository) {
      // remove from url
      const search = new URLSearchParams(window.location.search)
      search.delete('createRepository')
      const searchStr = search.toString()
      const newUrl = `${window.location.pathname}${
        searchStr ? `?${searchStr}` : ''
      }`
      window.history.replaceState(null, '', newUrl)
      createGithubRepository()
    }
  }, [createGithubRepository, createRepository])

  return (
    <>
      <Button
        onClick={createGithubRepository}
        variant="secondary"
        className="cursor-pointer bg-black text-white hover:bg-black/80 px-3 py-1.5 text-sm"
        disabled={performingAction}
      >
        <FaGithub className="mr-2 h-4 w-4" /> {createRepoButtonText}
      </Button>
      {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
    </>
  )
}