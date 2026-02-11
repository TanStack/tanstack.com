import { createFileRoute } from '@tanstack/react-router'
import JSZip from 'jszip'
import { compileHandler } from '~/builder/api'

const BASE64_PREFIX = 'base64::'

function decodeBase64File(content: string): Buffer | null {
  if (content.startsWith(BASE64_PREFIX)) {
    return Buffer.from(content.slice(BASE64_PREFIX.length), 'base64')
  }
  return null
}

export const Route = createFileRoute('/api/builder/download')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          const url = new URL(request.url)
          const name = url.searchParams.get('name') || 'my-tanstack-app'
          const featuresParam = url.searchParams.get('features') || ''
          const tailwind = url.searchParams.get('tailwind') !== 'false'

          const features = featuresParam
            .split(',')
            .map((f) => f.trim())
            .filter(Boolean)

          // Parse feature options (keys like "drizzle.database=postgres")
          const featureOptions: Record<string, Record<string, unknown>> = {}
          for (const [key, value] of url.searchParams.entries()) {
            if (key.includes('.') && value) {
              const [featureId, optionKey] = key.split('.')
              if (!featureOptions[featureId]) {
                featureOptions[featureId] = {}
              }
              featureOptions[featureId][optionKey] = value
            }
          }

          const result = await compileHandler({
            name,
            tailwind,
            features,
            featureOptions,
          })

          const zip = new JSZip()
          const rootFolder = zip.folder(name)
          if (!rootFolder) {
            throw new Error('Failed to create ZIP folder')
          }

          for (const [filePath, content] of Object.entries(result.files)) {
            // Handle base64-encoded binary files (SVGs, images, etc.)
            const binaryContent = decodeBase64File(content)
            if (binaryContent) {
              rootFolder.file(filePath, binaryContent, { binary: true })
            } else {
              rootFolder.file(filePath, content)
            }
          }

          const blob = await zip.generateAsync({ type: 'arraybuffer' })

          // Cache for 1 hour on CDN, allow stale for 1 day while revalidating
          const cacheControl =
            process.env.NODE_ENV === 'production'
              ? 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'
              : 'no-cache'

          return new Response(blob, {
            headers: {
              'Content-Type': 'application/zip',
              'Content-Disposition': `attachment; filename="${name}.zip"`,
              'Cache-Control': cacheControl,
            },
          })
        } catch (error) {
          console.error('Error generating ZIP:', error)
          return new Response(
            JSON.stringify({
              error: 'Failed to generate ZIP',
              details: error instanceof Error ? error.message : String(error),
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }
      },
    },
  },
})
