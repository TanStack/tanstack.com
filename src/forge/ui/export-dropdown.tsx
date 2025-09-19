import { useState } from 'react'
import { FaFileArchive, FaGithub } from 'react-icons/fa'
import { ChevronDown, Download } from 'lucide-react'
import JSZip from 'jszip'
import { authClient } from '~/utils/auth.client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/cta/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/cta/components/ui/dialog'
import { Button } from '~/cta/components/ui/button'
import { Input } from '~/cta/components/ui/input'
import { Label } from '~/cta/components/ui/label'

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
        message: 'Add TanStack Forge files',
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

const generateZipFromFiles = async (
  files: Array<{ path: string; content: string }>
) => {
  const zip = new JSZip()

  if (!files || files.length === 0) {
    console.error('No files found to export')
    return null
  }

  // Process the files array - each item has a path and content
  files.forEach(({ path, content }) => {
    if (typeof content === 'string') {
      // Remove any leading slashes to ensure proper zip structure
      const cleanPath = path.replace(/^\//, '')
      zip.file(cleanPath, content)
    }
  })

  return zip
}

interface ForgeExportDropdownProps {
  projectFiles: Array<{ path: string; content: string }>
  projectName?: string
}

export function ForgeExportDropdown({
  projectFiles,
  projectName,
}: ForgeExportDropdownProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showGitHubDialog, setShowGitHubDialog] = useState(false)
  const [repoName, setRepoName] = useState(projectName || '')
  const [repoVisibility, setRepoVisibility] = useState<'private' | 'public'>(
    'private'
  )
  const [isCreatingRepo, setIsCreatingRepo] = useState(false)

  const handleExportZip = async () => {
    if (isExporting) return
    setIsExporting(true)
    setError(null)

    try {
      const zip = await generateZipFromFiles(projectFiles)

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
      link.download = `${projectName || 'forge-project'}.zip`
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
    if (isCreatingRepo) return
    setError(null)
    setIsCreatingRepo(true)

    try {
      if (!repoName) {
        setError('Repository name is required')
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
          name: repoName,
          private: repoVisibility === 'private',
          auto_init: true, // Must be true to use createCommitOnBranch
        }),
      })

      const responseData = await response.json()

      if (!response.ok) {
        if (response.status === 404) {
          // This is the status we get when the user does not have proper scopes
          await authClient.linkSocial({
            provider: 'github',
            callbackURL: '/forge?createRepository=true',
            scopes: ['user:email', 'repo'],
          })

          return
        }

        if (responseData.errors) {
          throw new Error(responseData.errors[0].message)
        } else if (responseData.message) {
          throw new Error(responseData.message)
        } else {
          throw new Error('Failed to create repository')
        }
      }

      // Get the owner from the repository data
      const owner = responseData.owner.login
      const createdRepoName = responseData.name

      // Wait for GitHub to fully initialize the repository with auto_init
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Convert files array to files object for forcePushAllFiles
      const filesObject: Record<string, string> = {}
      projectFiles.forEach(({ path, content }) => {
        filesObject[path] = content
      })

      // Commit the project files to the repository
      if (projectFiles && projectFiles.length > 0) {
        try {
          const commitResult = await forcePushAllFiles(
            data?.accessToken!,
            owner,
            createdRepoName,
            responseData.default_branch || 'main',
            filesObject
          )
          console.log('Files force pushed successfully:', commitResult)
        } catch (commitError) {
          console.error('Error committing files:', commitError)
          // Don't show error for file commit failures, just open the repo
        }
      }

      // Close dialog and open the repository in a new tab
      setShowGitHubDialog(false)
      window.open(responseData.html_url, '_blank')

      return responseData
    } catch (error) {
      console.error(error)
      setError(`Failed to create repository: ${(error as Error).message}`)
    } finally {
      setIsCreatingRepo(false)
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
            onClick={() => {
              setRepoName(projectName || '')
              setError(null)
              setShowGitHubDialog(true)
            }}
            className="flex items-center gap-2 cursor-pointer"
          >
            <FaGithub className="h-4 w-4" />
            <span>Create GitHub Repo</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showGitHubDialog} onOpenChange={setShowGitHubDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create GitHub Repository</DialogTitle>
            <DialogDescription>
              Create a new GitHub repository with your project files
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="repo-name">Repository Name</Label>
              <Input
                id="repo-name"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                placeholder="my-awesome-project"
                disabled={isCreatingRepo}
              />
            </div>

            <div className="grid gap-2">
              <Label>Visibility</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    value="private"
                    checked={repoVisibility === 'private'}
                    onChange={() => setRepoVisibility('private')}
                    disabled={isCreatingRepo}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Private</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    value="public"
                    checked={repoVisibility === 'public'}
                    onChange={() => setRepoVisibility('public')}
                    disabled={isCreatingRepo}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Public</span>
                </label>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md">
                {error}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowGitHubDialog(false)}
              disabled={isCreatingRepo}
            >
              Cancel
            </Button>
            <Button
              onClick={createGithubRepository}
              disabled={isCreatingRepo || !repoName}
              variant="default"
            >
              <FaGithub className="mr-2 h-4 w-4" />
              {isCreatingRepo ? 'Creating...' : 'Create Repository'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
