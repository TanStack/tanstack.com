import { loadRemoteIntegration, loadTemplate } from '@tanstack/cli'
import type { IntegrationCompiled, CustomTemplateCompiled } from '@tanstack/cli'
import { validateRemoteUrl } from '~/utils/url-validation.server'

export interface RemoteIntegrationResponse {
  integration?: IntegrationCompiled
  error?: string
}

export interface RemoteTemplateResponse {
  template?: CustomTemplateCompiled
  error?: string
}

export async function loadRemoteIntegrationHandler(
  url: string,
): Promise<RemoteIntegrationResponse> {
  if (!url) {
    return { error: 'URL is required' }
  }

  // SSRF protection: validate URL before fetching
  const validation = validateRemoteUrl(url)
  if (!validation.valid) {
    return { error: validation.error }
  }

  try {
    const integration = await loadRemoteIntegration(validation.normalizedUrl!)
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

  // SSRF protection: validate URL before fetching
  const validation = validateRemoteUrl(url)
  if (!validation.valid) {
    return { error: validation.error }
  }

  try {
    const template = await loadTemplate(validation.normalizedUrl!)
    return { template }
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Failed to load template',
    }
  }
}
