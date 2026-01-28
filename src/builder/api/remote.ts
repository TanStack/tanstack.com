import { loadRemoteAddOn, loadStarter } from '@tanstack/cta-engine'
import { type AddOnCompiled, type StarterCompiled } from './compile'
import { validateRemoteUrl } from '~/utils/url-validation.server'

export interface RemoteIntegrationResponse {
  integration?: AddOnCompiled
  error?: string
}

export interface RemoteTemplateResponse {
  template?: StarterCompiled
  error?: string
}

export async function loadRemoteIntegrationHandler(
  url: string,
): Promise<RemoteIntegrationResponse> {
  if (!url) {
    return { error: 'URL is required' }
  }

  const validation = validateRemoteUrl(url)
  if (!validation.valid) {
    return { error: validation.error }
  }

  try {
    const addOn = await loadRemoteAddOn(validation.normalizedUrl!)
    const integration: AddOnCompiled = {
      ...addOn,
      files: addOn.files || {},
      deletedFiles: [],
    }
    return { integration }
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Failed to load integration',
    }
  }
}

export async function loadRemoteTemplateHandler(
  url: string,
): Promise<RemoteTemplateResponse> {
  if (!url) {
    return { error: 'URL is required' }
  }

  const validation = validateRemoteUrl(url)
  if (!validation.valid) {
    return { error: validation.error }
  }

  try {
    const starter = await loadStarter(validation.normalizedUrl!)
    const template = {
      ...starter,
      files: starter.files || {},
      deletedFiles: starter.deletedFiles || [],
      phase: 'setup' as const,
      modes: [starter.mode || 'file-router'],
    } as unknown as StarterCompiled
    return { template }
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Failed to load template',
    }
  }
}
