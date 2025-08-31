import { useState } from 'react'
import { FaFileArchive } from 'react-icons/fa'
import JSZip from 'jszip'
import { Button } from '../ui/button'
import { useDryRun } from '../../store/project'

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

export function ZipExportAction() {
  const dryRun = useDryRun()
  const [performingAction, setPerformingAction] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExportZip = async () => {
    if (performingAction) return
    setPerformingAction(true)
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
      setPerformingAction(false)
    }
  }

  return (
    <>
      <Button
        onClick={handleExportZip}
        variant="secondary"
        className="cursor-pointer bg-gray-200 text-black hover:bg-gray-300 px-3 py-1.5 text-sm"
        disabled={performingAction}
      >
        <FaFileArchive className="mr-2 h-4 w-4" /> Export ZIP
      </Button>
      {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
    </>
  )
}