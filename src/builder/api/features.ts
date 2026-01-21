import { fetchManifest } from '@tanstack/cli'
import type { ManifestIntegration } from '@tanstack/cli'
import { getAddonsBasePath } from './config'

const isDev = process.env.NODE_ENV !== 'production'

function normalizeUrl(url: string | undefined) {
  if (!url) return url
  if (isDev) {
    return url.replace(/^https?:\/\/tanstack\.com/, '')
  }
  return url
}

export interface FeatureOption {
  key: string
  type: 'select' | 'boolean' | 'string'
  label: string
  description?: string
  default: string | boolean | number | null
  choices?: Array<{ value: string; label: string }>
}

export interface FeatureInfo {
  id: string
  name: string
  description: string
  category: string
  requires: Array<string>
  conflicts: Array<string>
  hasOptions: boolean
  options?: Array<FeatureOption>
  link?: string
  color?: string
  partnerId?: string
  requiresTailwind?: boolean
  demoRequiresTailwind?: boolean
}

export interface TemplateInfo {
  id: string
  name: string
  description: string
  banner?: string
  icon?: string
  features?: Array<string>
  tailwind?: boolean
}

export interface FeaturesResponse {
  features: Array<FeatureInfo>
  templates: Array<TemplateInfo>
  version: string
}

function toFeatureInfo(integration: ManifestIntegration): FeatureInfo {
  return {
    id: integration.id,
    name: integration.name,
    description: integration.description,
    category: integration.category ?? 'other',
    requires: integration.dependsOn ?? [],
    conflicts: integration.conflicts ?? [],
    hasOptions: integration.hasOptions ?? false,
    link: normalizeUrl(integration.link),
    color: integration.color,
    partnerId: integration.partnerId,
    requiresTailwind: integration.requiresTailwind,
    demoRequiresTailwind: integration.demoRequiresTailwind,
  }
}

export async function getFeaturesHandler(): Promise<FeaturesResponse> {
  const basePath = getAddonsBasePath()
  const manifest = await fetchManifest(basePath)

  const features = manifest.integrations
    .filter((i) => ['integration', 'deployment', 'toolchain'].includes(i.type))
    .map(toFeatureInfo)

  const templates = manifest.customTemplates ?? []

  return {
    features,
    templates: templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      banner: t.banner,
      icon: t.icon,
      features: t.features,
    })),
    version: manifest.version,
  }
}
