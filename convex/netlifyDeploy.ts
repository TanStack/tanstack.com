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

export const deployToNetlify = action({
  args: {
    zipBase64: v.string(),
    siteName: v.string(),
  },
  handler: async (ctx, args) => {
    // Convert base64 to Uint8Array
    const zipBuffer = base64ToUint8Array(args.zipBase64)
    
    // Get Netlify token from environment
    const netlifyToken = process.env.NETLIFY_TOKEN
    if (!netlifyToken) {
      throw new Error('NETLIFY_TOKEN not configured')
    }

    try {
      // Step 1: Create a new site
      const createSiteResponse = await fetch('https://api.netlify.com/api/v1/sites', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${netlifyToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${args.siteName}-${Date.now()}`,
          custom_domain: null,
        }),
      })

      if (!createSiteResponse.ok) {
        const error = await createSiteResponse.text()
        throw new Error(`Failed to create site: ${error}`)
      }

      const site = await createSiteResponse.json()
      const siteId = site.id

      console.log('Site created successfully:', site)

      console.log('Deploying ZIP file...')

      // Step 2: Deploy the ZIP file
      const deployResponse = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${netlifyToken}`,
          'Content-Type': 'application/zip',
          'Content-Length': zipBuffer.length.toString(),
        },
        body: zipBuffer as any, // Uint8Array can be used as body
      })

      if (!deployResponse.ok) {
        const error = await deployResponse.text()
        throw new Error(`Failed to deploy: ${error}`)
      }

      const deploy = await deployResponse.json()

      console.log('Deploy completed successfully:', deploy)

        // Step 3: Create a claim URL for the deploy-and-claim pattern
      const claimUrl = `https://app.netlify.com/sites/${site.name}/deploys/${deploy.id}`
      

      console.log('Claim URL:', claimUrl)
      // Return the deployed site URL and claim URL
      return {
        url: deploy.ssl_url || deploy.url,
        claimUrl: claimUrl,
        siteId: siteId,
        deployId: deploy.id,
        siteName: site.name,
      }
    } catch (error) {
      console.error('Netlify deployment error:', error)
      throw error
    }
  },
})

// Alternative implementation using deploy-and-claim pattern (no auth required)
export const deployAndClaim = action({
  args: {
    zipBase64: v.string(),
    siteName: v.string(),
  },
  handler: async (ctx, args) => {
    const zipBuffer = base64ToUint8Array(args.zipBase64)
    
    // Using the Netlify deploy-and-claim API
    // This doesn't require authentication and creates unclaimed sites
    try {
      // Deploy without authentication (creates unclaimed site)
      const deployResponse = await fetch('https://api.netlify.com/api/v1/sites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/zip',
        },
        body: zipBuffer as any,
      })

      if (!deployResponse.ok) {
        const error = await deployResponse.text()
        throw new Error(`Failed to deploy: ${error}`)
      }

      const deploy = await deployResponse.json()
      
      // Generate claim URL
      const claimUrl = `https://app.netlify.com/sites/${deploy.subdomain}/deploys/${deploy.deploy_id}#claim`
      
      return {
        url: deploy.url || `https://${deploy.subdomain}.netlify.app`,
        claimUrl: claimUrl,
        deployId: deploy.deploy_id,
        siteName: deploy.subdomain,
      }
    } catch (error) {
      console.error('Deploy and claim error:', error)
      throw error
    }
  },
})