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

  // Check for conflicts
  for (const featureId of definition.features) {
    const integration = integrationMap.get(featureId)
    if (integration?.conflicts) {
      for (const conflictId of integration.conflicts) {
        if (definition.features.includes(conflictId)) {
          errors.push({
            field: 'features',
            message: `'${featureId}' conflicts with '${conflictId}'`,
          })
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    suggestions,
  }
}
