import { loadRemoteAddOn } from '@tanstack/create/dist/edge-add-ons.js'
import type { AddOn } from '@tanstack/create/edge'
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

function toIntegrationCompiled(addOn: AddOn): AddOnCompiled {
  return {
    id: addOn.id,
    name: addOn.name,
    description: addOn.description,
    type: addOn.type,
    phase: addOn.phase,
    modes: addOn.modes,
    files: addOn.files ?? {},
    deletedFiles: addOn.deletedFiles ?? [],
    dependsOn: addOn.dependsOn,
    options: addOn.options,
    link: addOn.link,
    tailwind: addOn.tailwind ?? true,
    requiresTailwind: addOn.tailwind === true ? undefined : !addOn.tailwind,
    warning: addOn.warning,
    priority: addOn.priority,
    author: addOn.author,
    version: addOn.version,
    license: addOn.license,
    category: addOn.category,
    packageAdditions: addOn.packageAdditions,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isStringArray(value: unknown): value is Array<string> {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.values(value).every((item) => typeof item === 'string')
  )
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === 'string' ? value : undefined
}

function readOptionalBoolean(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === 'boolean' ? value : undefined
}

function readStringRecord(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return isStringRecord(value) ? value : undefined
}

function toRemoteTemplate(value: unknown, url: string): StarterCompiled | null {
  if (!isRecord(value)) return null

  const name = readString(value, 'name')
  const description = readString(value, 'description')
  const framework = readString(value, 'framework')
  const mode = readString(value, 'mode')
  const files = readStringRecord(value, 'files')

  if (!name || !description || !framework || !mode || !files) {
    return null
  }

  return {
    id: readString(value, 'id') ?? url,
    name,
    description,
    type: 'starter',
    phase: 'setup',
    modes: isStringArray(value.modes) ? value.modes : [mode],
    files,
    deletedFiles: isStringArray(value.deletedFiles) ? value.deletedFiles : [],
    framework,
    mode,
    typescript: readOptionalBoolean(value, 'typescript') ?? true,
    tailwind: readOptionalBoolean(value, 'tailwind') ?? true,
    banner: readString(value, 'banner'),
    dependsOn: isStringArray(value.dependsOn) ? value.dependsOn : undefined,
  }
}

async function loadRemoteTemplate(url: string) {
  const response = await fetch(url)
  const json: unknown = await response.json()
  const template = toRemoteTemplate(json, url)

  if (!template) {
    throw new Error(`Invalid starter: ${url}`)
  }

  return template
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
    const integration = toIntegrationCompiled(addOn)
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
    const template = await loadRemoteTemplate(validation.normalizedUrl!)
    return { template }
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Failed to load template',
    }
  }
}
