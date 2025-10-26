import { action } from './_generated/server'
import { v } from 'convex/values'

// Helper function to convert base64 to Uint8Array (works in Convex)
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

// Helper function to create FormData with zip file
async function createFormData(
  zipBuffer: Uint8Array,
  title: string
): Promise<{ buffer: Uint8Array; boundary: string }> {
  const boundary = `----FormBoundary${Date.now()}`

  // Build multipart form data manually
  const textEncoder = new TextEncoder()
  const parts: Uint8Array[] = []

  // Add title field
  parts.push(textEncoder.encode(`--${boundary}\r\n`))
  parts.push(
    textEncoder.encode(`Content-Disposition: form-data; name="title"\r\n\r\n`)
  )
  parts.push(textEncoder.encode(`${title}\r\n`))

  // Add zip file field
  parts.push(textEncoder.encode(`--${boundary}\r\n`))
  parts.push(
    textEncoder.encode(
      `Content-Disposition: form-data; name="zip"; filename="deploy.zip"\r\n`
    )
  )
  parts.push(textEncoder.encode(`Content-Type: application/zip\r\n\r\n`))
  parts.push(zipBuffer)
  parts.push(textEncoder.encode(`\r\n`))

  // Add final boundary
  parts.push(textEncoder.encode(`--${boundary}--\r\n`))

  // Combine all parts
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const combined = new Uint8Array(totalLength)
  let offset = 0
  for (const part of parts) {
    combined.set(part, offset)
    offset += part.length
  }

  return { buffer: combined, boundary }
}

// Deploy to Netlify using Build API and create claimable site
export const deployToNetlify = action({
  args: {
    zipBase64: v.string(),
    siteName: v.string(),
    deployTitle: v.optional(v.string()),
  },
  handler: async (_, args) => {
    // Convert base64 to Uint8Array
    const zipBuffer = base64ToUint8Array(args.zipBase64)

    // Get Netlify credentials from environment
    const netlifyToken = process.env.NETLIFY_TOKEN
    const netlifyTeamSlug = process.env.NETLIFY_TEAM_SLUG

    if (!netlifyToken) {
      throw new Error('NETLIFY_TOKEN not configured')
    }

    try {
      // Step 1: Create a new site
      const sitePayload: any = {
        name: `${args.siteName}-${Date.now()}`,
        custom_domain: null,
      }

      // Optional: specify team
      if (netlifyTeamSlug) {
        sitePayload.account_slug = netlifyTeamSlug
      }

      const createSiteResponse = await fetch(
        'https://api.netlify.com/api/v1/sites',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${netlifyToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(sitePayload),
        }
      )

      if (!createSiteResponse.ok) {
        const error = await createSiteResponse.text()
        throw new Error(`Failed to create site: ${error}`)
      }

      const site = await createSiteResponse.json()
      const siteId = site.id

      console.log('Site created successfully:', site)

      // Step 2: Use the Build API to trigger a build with the ZIP file
      const deployTitle =
        args.deployTitle ||
        `Deployed from TanStack Forge at ${new Date().toISOString()}`

      // Create form data with title and zip
      const { buffer: formDataBuffer, boundary } = await createFormData(
        zipBuffer,
        deployTitle
      )

      console.log('Triggering build with ZIP file...')

      const buildResponse = await fetch(
        `https://api.netlify.com/api/v1/sites/${siteId}/builds`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${netlifyToken}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
          body: formDataBuffer as any,
        }
      )

      if (!buildResponse.ok) {
        const error = await buildResponse.text()
        throw new Error(`Failed to trigger build: ${error}`)
      }

      const build = await buildResponse.json()

      console.log('Build triggered successfully:', build)

      // Step 3: Generate a claim URL using the Netlify API
      // Note: The PAT used here must be associated with an OAuth app to generate claim URLs
      let claimUrl: string | undefined = undefined

      try {
        const claimResponse = await fetch(
          `https://api.netlify.com/api/v1/sites/${siteId}/claim`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${netlifyToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
          }
        )

        if (claimResponse.ok) {
          const claimData = await claimResponse.json()
          claimUrl = claimData.claim_url
          console.log('Claimable site created with claim URL')
        } else {
          const error = await claimResponse.text()
          console.log(
            'Could not generate claim URL (PAT may not be associated with an OAuth app):',
            error
          )
        }
      } catch (error) {
        console.log('Failed to generate claim URL:', error)
      }

      // Return the deployed site URL and build information
      return {
        url: site.ssl_url || site.url || `https://${site.name}.netlify.app`,
        adminUrl: site.admin_url,
        claimUrl: claimUrl, // URL for users to claim the site (or undefined if claim endpoint failed)
        siteId: siteId,
        deployId: build.deploy_id,
        buildId: build.id,
        siteName: site.name,
        buildStatus: build.state, // 'building', 'ready', 'error'
        isClaimable: !!claimUrl, // Indicates if claim URL was successfully generated
      }
    } catch (error) {
      console.error('Netlify deployment error:', error)
      throw error
    }
  },
})

// Check build status
export const checkBuildStatus = action({
  args: {
    siteId: v.string(),
    deployId: v.string(),
  },
  handler: async (_, args) => {
    const netlifyToken = process.env.NETLIFY_TOKEN
    if (!netlifyToken) {
      throw new Error('NETLIFY_TOKEN not configured')
    }

    try {
      const response = await fetch(
        `https://api.netlify.com/api/v1/sites/${args.siteId}/deploys/${args.deployId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${netlifyToken}`,
          },
        }
      )

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to get deploy status: ${error}`)
      }

      const deploy = await response.json()

      return {
        state: deploy.state, // 'building', 'ready', 'error', 'new', 'processing'
        errorMessage: deploy.error_message,
        url: deploy.ssl_url || deploy.url,
        adminUrl: deploy.admin_url,
        publishTime: deploy.published_at,
        buildTime: deploy.build_time,
      }
    } catch (error) {
      console.error('Error checking build status:', error)
      throw error
    }
  },
})
