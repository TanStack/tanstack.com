import {
  compile,
  compileWithAttribution,
  fetchIntegrations,
  type AttributedCompileOutput,
  type IntegrationCompiled,
  type CustomTemplateCompiled,
  type RouterMode,
  type PackageManager,
} from '@tanstack/cli'
import { getAddonsBasePath } from './config'

export interface ProjectDefinition {
  name: string
  tailwind?: boolean
  features: Array<string>
  featureOptions: Record<string, Record<string, unknown>>
  customIntegrations?: Array<IntegrationCompiled>
  customTemplate?: CustomTemplateCompiled | null
}

export interface CompileRequest {
  definition: ProjectDefinition
  format?: 'full' | 'summary'
}

export interface CompileResponse {
  files: Record<string, string>
  packages: {
    dependencies: Record<string, string>
    devDependencies: Record<string, string>
    scripts: Record<string, string>
  }
  envVars: Array<{
    name: string
    description: string
    required?: boolean
    example?: string
  }>
  commands: Array<{
    command: string
    args?: Array<string>
  }>
  warnings: Array<string>
}

export interface CompileHandlerOptions {
  format?: 'full' | 'summary'
}

export async function compileHandler(
  definition: ProjectDefinition,
  options: CompileHandlerOptions = {},
): Promise<CompileResponse> {
  const basePath = getAddonsBasePath()

  const customIds = new Set(
    (definition.customIntegrations ?? []).map((i) => i.id),
  )

  const manifestFeatures = definition.features.filter((id) => !customIds.has(id))

  const manifestIntegrations: Array<IntegrationCompiled> =
    manifestFeatures.length > 0
      ? await fetchIntegrations(manifestFeatures, basePath)
      : []

  const chosenIntegrations = [
    ...manifestIntegrations,
    ...(definition.customIntegrations ?? []),
  ]

  const output = compile({
    projectName: definition.name,
    framework: 'react',
    mode: 'file-router' as RouterMode,
    typescript: true,
    tailwind: definition.tailwind ?? true,
    packageManager: 'pnpm' as PackageManager,
    chosenIntegrations,
    integrationOptions: definition.featureOptions,
    customTemplate: definition.customTemplate ?? undefined,
  })

  return {
    files: options.format === 'summary' ? {} : output.files,
    packages: output.packages,
    envVars: output.envVars,
    commands: [],
    warnings: output.warnings,
  }
}

export async function compileWithAttributionHandler(
  definition: ProjectDefinition,
): Promise<AttributedCompileOutput> {
  const basePath = getAddonsBasePath()

  const customIds = new Set(
    (definition.customIntegrations ?? []).map((i) => i.id),
  )

  const manifestFeatures = definition.features.filter((id) => !customIds.has(id))

  const manifestIntegrations: Array<IntegrationCompiled> =
    manifestFeatures.length > 0
      ? await fetchIntegrations(manifestFeatures, basePath)
      : []

  const chosenIntegrations = [
    ...manifestIntegrations,
    ...(definition.customIntegrations ?? []),
  ]

  return compileWithAttribution({
    projectName: definition.name,
    framework: 'react',
    mode: 'file-router' as RouterMode,
    typescript: true,
    tailwind: definition.tailwind ?? true,
    packageManager: 'pnpm' as PackageManager,
    chosenIntegrations,
    integrationOptions: definition.featureOptions,
    customTemplate: definition.customTemplate ?? undefined,
  })
}
