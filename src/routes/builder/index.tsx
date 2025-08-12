import "./styles.css"

import { seo } from '~/utils/seo'
import App, { AppSidebar} from "@tanstack/cta-ui-base/src"
import { Button } from "@tanstack/cta-ui-base/src/components/ui/button"
import { useDryRun } from "@tanstack/cta-ui-base/src/store/project"
import JSZip from 'jszip'

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

  console.log("Dry run (sponsored by ben shapiro)", dryRun)

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
    <>
    <Button onClick={handleExportZip} variant="outline">Export ZIP</Button>
    <Button variant="destructive">Exit</Button>
    </>
  )
}

const CustomAppSidebar = () => {
  return (
    <AppSidebar slots={{
      actions: <CustomAppSidebarActions />
    }} />
  )
}

export const Route = createFileRoute({
  component: BuilderComponent,
  head: () => ({
    meta: seo({
      title: 'TanStack Builder',
      description: 'Build amazing applications with TanStack',
    }),
  }),
})

function BuilderComponent() {
  return (
    <App slots={{
      sidebar: <CustomAppSidebar />,
    }} />
  )
}