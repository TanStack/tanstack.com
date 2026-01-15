import { createFileRoute } from '@tanstack/react-router'
import { registerFramework } from '@tanstack/cta-engine'
import { createFrameworkDefinition } from '@tanstack/cta-framework-react-cra'
import { createAppWrapper } from '@tanstack/cta-ui/lib/engine-handling/create-app-wrapper'

// Ensure framework is registered
registerFramework(createFrameworkDefinition())

// Patch vite.config.ts for WebContainer compatibility
// WebContainer can't run workerd, so we need to use node-ws preset
function patchFilesForWebContainer(
  files: Record<string, string>,
): Record<string, string> {
  const patched = { ...files }

  // Find and patch vite.config.ts
  for (const [path, content] of Object.entries(patched)) {
    if (path.endsWith('vite.config.ts')) {
      let patchedContent = content

      // Use node-ws preset instead of workerd
      if (patchedContent.includes('tanstackStart()')) {
        patchedContent = patchedContent.replace(
          /tanstackStart\(\)/g,
          "tanstackStart({ preset: 'node-ws' })",
        )
      }

      // Fix duplicate resolve key issue by removing the second one
      // This happens when both base and start vite configs are merged incorrectly
      const resolveMatches = patchedContent.match(/resolve:\s*\{/g)
      if (resolveMatches && resolveMatches.length > 1) {
        // Remove the second resolve block (keep the first one)
        let firstResolveFound = false
        patchedContent = patchedContent.replace(
          /,?\s*resolve:\s*\{[^}]*\}/g,
          (match) => {
            if (!firstResolveFound) {
              firstResolveFound = true
              return match
            }
            return '' // Remove subsequent resolve blocks
          },
        )
      }

      patched[path] = patchedContent
    }
  }

  return patched
}

export const Route = createFileRoute('/api/dry-run-create-app')({
  // @ts-expect-error server property not in route types yet
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = await request.json()

        try {
          const output = await createAppWrapper(body.options, {
            dryRun: true,
          })

          if (!output) {
            throw new Error('No output from createAppWrapper')
          }

          // Patch files for WebContainer compatibility
          const patchedFiles = patchFilesForWebContainer(output.files)

          return new Response(
            JSON.stringify({ ...output, files: patchedFiles }),
            {
              headers: { 'Content-Type': 'application/json' },
            },
          )
        } catch (error) {
          return new Response(
            JSON.stringify({
              files: {},
              commands: [],
              deletedFiles: [],
            }),
            {
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }
      },
    },
  },
})
