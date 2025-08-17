import styles from '~/styles/builder.css?url'
import { seo } from '~/utils/seo'
import App, { AppSidebar } from '@tanstack/cta-ui-base/src'
import { Button } from '@tanstack/cta-ui-base/src/components/ui/button'
import { useDryRun } from '@tanstack/cta-ui-base/src/store/project'
import JSZip from 'jszip'
import { FaFileArchive } from 'react-icons/fa'

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

  const handleExportZip = async () => {
    try {
      const zip = await generateZipFromDryRun(dryRun)

      if (!zip) {
        alert('No files to export')
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
      alert('Failed to export ZIP file')
    }
  }

  return (
    <div className="p-4 bg-background/40 rounded-xl">
      <Button
        onClick={handleExportZip}
        variant="secondary"
        className="w-full cursor-pointer"
      >
        <FaFileArchive className="mr-2" /> Export ZIP
      </Button>
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
})

function BuilderComponent() {
  return (
    <App
      slots={{
        sidebar: <CustomAppSidebar />,
      }}
    />
  )
}
