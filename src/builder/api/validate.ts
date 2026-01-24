/**
 * Validate API Handler (v2)
 *
 * Uses @tanstack/cli to validate project definitions.
 */

import { fetchManifest } from '@tanstack/cli'
import type { ProjectDefinition } from './compile'
import { getAddonsBasePath } from './config'

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationSuggestion {
  type: 'add' | 'remove' | 'change'
  feature?: string
  option?: string
  value?: unknown
  reason: string
}

export interface ValidateResponse {
  valid: boolean
  errors: Array<ValidationError>
  suggestions: Array<ValidationSuggestion>
}

export async function validateHandler(
  definition: ProjectDefinition,
): Promise<ValidateResponse> {
  const basePath = getAddonsBasePath()
  const manifest = await fetchManifest(basePath)

  const errors: Array<ValidationError> = []
  const suggestions: Array<ValidationSuggestion> = []

  // Build integration lookup
  const integrationMap = new Map(manifest.integrations.map((i) => [i.id, i]))

  // Validate project name
  if (!definition.name || definition.name.trim() === '') {
    errors.push({
      field: 'name',
      message: 'Project name is required',
    })
  } else if (!/^[a-z0-9-_]+$/.test(definition.name)) {
    errors.push({
      field: 'name',
      message:
        'Project name can only contain lowercase letters, numbers, hyphens, and underscores',
    })
  }

  // Validate features exist
  for (const featureId of definition.features) {
    if (!integrationMap.has(featureId)) {
      errors.push({
        field: 'features',
        message: `Unknown feature: ${featureId}`,
      })
    }
  }

  // Check for missing dependencies
  for (const featureId of definition.features) {
    const integration = integrationMap.get(featureId)
    if (integration?.dependsOn) {
      for (const requiredId of integration.dependsOn) {
        if (!definition.features.includes(requiredId)) {
          suggestions.push({
            type: 'add',
            feature: requiredId,
            reason: `'${featureId}' requires '${requiredId}'`,
          })
        }
      }
    }
  }

  // Check for exclusive type conflicts
  // Build a map of exclusive type -> list of selected integrations with that type
  const exclusiveTypeMap = new Map<string, Array<string>>()
  for (const featureId of definition.features) {
    const integration = integrationMap.get(featureId)
    if (integration?.exclusive) {
      for (const exclusiveType of integration.exclusive) {
        const existing = exclusiveTypeMap.get(exclusiveType) || []
        existing.push(featureId)
        exclusiveTypeMap.set(exclusiveType, existing)
      }
    }
  }

  // Report conflicts for exclusive types with more than one integration
  for (const [exclusiveType, integrationIds] of exclusiveTypeMap) {
    if (integrationIds.length > 1) {
      errors.push({
        field: 'features',
        message: `Only one ${exclusiveType} integration allowed. Selected: ${integrationIds.join(', ')}`,
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    suggestions,
  }
}
