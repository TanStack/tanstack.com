import styles from '~/styles/builder.css?url'
import { seo } from '~/utils/seo'
import App, { AppSidebar } from '@tanstack/cta-ui-base/src'
import { Button } from '@tanstack/cta-ui-base/src/components/ui/button'
import { useDryRun } from '@tanstack/cta-ui-base/src/store/project'
import JSZip from 'jszip'
import { FaFileArchive, FaGithub } from 'react-icons/fa'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { Authenticated } from 'convex/react'
import { useLocation } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { authClient } from '~/utils/auth'

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

export const CustomAppSidebarActions = () => {
  const dryRun = useDryRun()
  const [performingAction, setPerformingAction] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const createRepository = useLocation().searchStr.includes('createRepository')

  const handleExportZip = async () => {
    if (performingAction) return
    setPerformingAction(true)
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
      setPerformingAction(false)
    }
  }

  const createGithubRepository = useCallback(
    async (opts: { name: string }) => {
      if (performingAction) return

      setPerformingAction(true)
      try {
        const { data, error } = await authClient.getAccessToken({ providerId: 'github' })
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
            name: opts.name,
          }),
        })

        const repoData = await response.json()

        if (!response.ok) {
          if (response.status === 404) { // This is the status we get when the user does not have proper scopes
            await authClient.linkSocial({
              provider: 'github',
              callbackURL: '/builder?createRepository=true',
              scopes: ['user:email', 'repo'],
            })
  
            return
          }

          throw new Error(repoData.errors[0].message)
        }

        return repoData
      } catch (error) {
        console.error(error)
        setError(`Failed to create repository: ${(error as Error).message}`)
      } finally {
        setPerformingAction(false)
      }
    },
    [performingAction]
  )

  useEffect(() => {
    if (createRepository) {
      // remove from url
      const search = new URLSearchParams(window.location.search)
      search.delete('createRepository')
      const newUrl = `${window.location.pathname}?${search.toString()}`
      window.history.replaceState(null, '', newUrl)
      createGithubRepository({ name: 'tanstack-app' })
    }
  }, [createGithubRepository, createRepository])

  return (
    <div className="p-4 bg-background/40 rounded-xl">
      <Button
        onClick={handleExportZip}
        variant="secondary"
        className="w-full cursor-pointer"
        disabled={performingAction}
      >
        <FaFileArchive className="mr-2" /> Export ZIP
      </Button>

      <Button
        onClick={() => createGithubRepository({ name: 'tanstack-app' })}
        variant="secondary"
        className="w-full cursor-pointer bg-black text-white hover:bg-black/80"
        disabled={performingAction}
      >
        <FaGithub className="mr-2" /> Create Repository
      </Button>
      {error && (
        <p className="text-red-500 mt-2">{error}</p>
      )}
    </div>
  )
}

const CustomAppSidebar = () => {
  return (
    <AppSidebar
      slots={{
        actions: <CustomAppSidebarActions />,
      }}
    />
  )
}

export const Route = createFileRoute({
  ssr: false,
  component: BuilderComponent,
  head: () => ({
    links: [
      {
        rel: 'stylesheet',
        href: styles,
      },
    ],
    meta: seo({
      title: 'TanStack Builder',
      description: 'Build amazing applications with TanStack',
    }),
  }),
  loader: async (opts) => {
    await opts.context.queryClient.ensureQueryData(
      convexQuery(api.auth.getCurrentUser, {})
    )
  },
})

function BuilderComponent() {
  const { isLoading, data: user } = useCurrentUserQuery()
  if (isLoading) {
    return null
  }

  if (!user?.capabilities.includes('builder')) {
    return null
  }

  return (
    <Authenticated>
      <App
        slots={{
          sidebar: <CustomAppSidebar />,
        }}
      />
    </Authenticated>
  )
}
