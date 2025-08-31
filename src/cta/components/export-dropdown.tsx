import { useState } from 'react'
import { FaFileArchive, FaGithub } from 'react-icons/fa'
import { ChevronDown, Download } from 'lucide-react'
import JSZip from 'jszip'
import { useLocation } from '@tanstack/react-router'
import { authClient } from '~/utils/auth.client'
import { useDryRun, useProjectOptions } from '../store/project'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Button } from './ui/button'

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

const generateZipFromDryRun = async (dryRun: any) => {
  const zip = new JSZip()

  if (!dryRun || !dryRun.files) {
    console.error('No files found in dry run output')
    return null
  }

  // Process the files object - each key is a file path, each value is the content
  Object.entries(dryRun.files).forEach(([filePath, content]) => {
    if (typeof content === 'string') {
      // Remove any leading slashes to ensure proper zip structure
      const cleanPath = filePath.replace(/^\//, '')
      zip.file(cleanPath, content)
    }
  })

  return zip
}

export function ExportDropdown() {
  const dryRun = useDryRun()
  const projectOptions = useProjectOptions()
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const createRepository = useLocation().searchStr.includes('createRepository')
  const [createRepoButtonText, setCreateRepoButtonText] = useState(
    createRepository ? 'Creating new repo...' : 'Create Repository'
  )

  const handleExportZip = async () => {
    if (isExporting) return
    setIsExporting(true)
    setError(null)
    
    try {
      const zip = await generateZipFromDryRun(dryRun)

      if (!zip) {
        setError('No files to export')
        return
      }

      // Generate the zip file
      const blob = await zip.generateAsync({ type: 'blob' })

      // Create download link
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'tanstack-app.zip'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      console.log('ZIP export completed successfully')
    } catch (error) {
      console.error('Error exporting ZIP:', error)
      setError('Failed to export ZIP file')
    } finally {
      setIsExporting(false)
    }
  }

  const createGithubRepository = async () => {
    if (isExporting) return
    setError(null)

    setIsExporting(true)
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
      setIsExporting(false)
      setCreateRepoButtonText('Create Repository')
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            className="flex items-center gap-2 bg-gray-200 text-black hover:bg-gray-300 px-3 py-1.5 text-sm"
            disabled={isExporting}
          >
            <Download className="h-4 w-4 mr-1" />
            Export
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={handleExportZip}
            className="flex items-center gap-2 cursor-pointer"
          >
            <FaFileArchive className="h-4 w-4" />
            <span>Export as ZIP</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={createGithubRepository}
            className="flex items-center gap-2 cursor-pointer"
          >
            <FaGithub className="h-4 w-4" />
            <span>Create GitHub Repo</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error && (
        <div className="absolute top-full right-0 mt-2 p-2 bg-red-100 text-red-700 text-xs rounded">
          {error}
        </div>
      )}
    </>
  )
}