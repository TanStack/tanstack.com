import { api } from 'convex/_generated/api'
import { ConvexReactClient } from 'convex/react'

// Helper function to get LLM keys from Convex (for server-side use)
export async function getLLMKeysFromConvex(convex: ConvexReactClient) {
  try {
    return await convex.query(api.llmKeys.listMyLLMKeys)
  } catch (error) {
    console.error('Error fetching LLM keys:', error)
    return []
  }
}

// Helper function to check if user has active keys (for server-side use)
export async function hasActiveKeysFromConvex(convex: ConvexReactClient) {
  try {
    const keys = await convex.query(api.llmKeys.listMyLLMKeys)
    return keys.some((key) => key.isActive)
  } catch (error) {
    console.error('Error checking active keys:', error)
    return false
  }
}

// Helper function to check if user has active keys from a keys array
export function hasActiveKeys(keys: any[]) {
  return keys.some((key) => key.isActive)
}
