import {
  createApp,
  createMemoryEnvironment,
  finalizeAddOns,
  populateAddOnOptionsDefaults,
  computeAttribution,
  type AddOn,
  type Starter,
  type LineAttribution as CtaLineAttribution,
  type AttributedFile as CtaAttributedFile,
} from '@tanstack/create'

type AddOnType = 'add-on' | 'example' | 'starter' | 'toolchain' | 'deployment'
type AddOnPhase = 'setup' | 'add-on'

export interface AddOnCompiled {
  id: string
  name: string
  description: string
  type: AddOnType
  phase: AddOnPhase
  modes: Array<string>
  files: Record<string, string>
  deletedFiles: Array<string>
  dependsOn?: Array<string>
  options?: Record<string, unknown>
  link?: string
  tailwind: boolean
  requiresTailwind?: boolean
  warning?: string
  priority?: number
  author?: string
  version?: string
  license?: string
  category?: string
  packageAdditions?: {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    scripts?: Record<string, string>
  }
}

export interface StarterCompiled {
  id: string
  name: string
  description: string
  type: AddOnType
  phase: AddOnPhase
  modes: Array<string>
  files: Record<string, string>
  deletedFiles: Array<string>
  framework: string
  mode: string
  typescript: boolean
  tailwind: boolean
  banner?: string
  dependsOn?: Array<string>
}
import { getFramework, DEFAULT_MODE, DEFAULT_REQUIRED_ADDONS, type FrameworkId } from './config'

export interface ProjectDefinition {
  name: string
  framework?: FrameworkId
  tailwind?: boolean
  features: Array<string>
  featureOptions: Record<string, Record<string, unknown>>
  selectedExample?: string
  customIntegrations?: Array<AddOnCompiled>
  customTemplate?: StarterCompiled | null
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

async function resolveAddOns(
  featureIds: Array<string>,
  customAddOns: Array<AddOnCompiled>,
  frameworkId: FrameworkId = 'react-cra',
): Promise<Array<AddOn>> {
  const framework = getFramework(frameworkId)
  const allFrameworkAddOns = framework.getAddOns()

  const customIds = new Set(customAddOns.map((a: AddOnCompiled) => a.id))

  const frameworkFeatureIds = featureIds.filter((id) => !customIds.has(id))

  const resolvedFramework = await finalizeAddOns(
    framework,
    DEFAULT_MODE,
    [...DEFAULT_REQUIRED_ADDONS, ...frameworkFeatureIds],
  )

  const customAsAddOns = customAddOns.map((compiled: AddOnCompiled) => ({
    ...compiled,
    getFiles: () => Promise.resolve(Object.keys(compiled.files)),
    getFileContents: (path: string) => Promise.resolve(compiled.files[path] ?? ''),
    getDeletedFiles: () => Promise.resolve(compiled.deletedFiles || []),
  })) as unknown as Array<AddOn>

  for (const custom of customAsAddOns) {
    if (custom.dependsOn) {
      for (const depId of custom.dependsOn) {
        if (!resolvedFramework.some((a: AddOn) => a.id === depId)) {
          const depAddOn = allFrameworkAddOns.find((a: AddOn) => a.id === depId)
          if (depAddOn && !resolvedFramework.some((a: AddOn) => a.id === depId)) {
            resolvedFramework.push(depAddOn)
          }
        }
      }
    }
  }

  return [...resolvedFramework, ...customAsAddOns]
}

function extractEnvVars(
  addOns: Array<AddOn>,
): Array<{ name: string; description: string; required?: boolean; example?: string }> {
  const envVars: Array<{ name: string; description: string; required?: boolean; example?: string }> = []
  const seen = new Set<string>()

  for (const addOn of addOns) {
    const files = addOn.files || {}
    for (const [path, content] of Object.entries(files) as Array<[string, string]>) {
      if (path.endsWith('.env') || path.endsWith('.env.example') || path.endsWith('.env.local.example')) {
        const lines = content.split('\n')
        for (const line of lines) {
          const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
          if (match && !seen.has(match[1])) {
            seen.add(match[1])
            envVars.push({
              name: match[1],
              description: `Environment variable from ${addOn.name}`,
              example: match[2] || undefined,
            })
          }
        }
      }
    }
  }

  return envVars
}

function extractWarnings(addOns: Array<AddOn>): Array<string> {
  return addOns
    .filter((a) => a.warning)
    .map((a) => `${a.name}: ${a.warning}`)
}

function _convertToStarter(template: StarterCompiled): Starter {
  return {
    ...template,
    getFiles: () => Promise.resolve(Object.keys(template.files)),
    getFileContents: (path: string) => Promise.resolve(template.files[path] ?? ''),
    getDeletedFiles: () => Promise.resolve(template.deletedFiles || []),
  } as unknown as Starter
}

function mergeOptionsWithDefaults(
  chosenAddOns: Array<AddOn>,
  userOptions: Record<string, Record<string, unknown>>,
): Record<string, Record<string, unknown>> {
  const defaults = populateAddOnOptionsDefaults(chosenAddOns)
  const merged: Record<string, Record<string, unknown>> = { ...defaults }

  for (const [addonId, options] of Object.entries(userOptions)) {
    merged[addonId] = { ...merged[addonId], ...options }
  }

  return merged
}

export async function compileHandler(
  definition: ProjectDefinition,
  options: CompileHandlerOptions = {},
): Promise<CompileResponse> {
  const frameworkId = definition.framework ?? 'react-cra'
  const framework = getFramework(frameworkId)

  // Merge selectedExample into features (CTA treats examples as add-ons)
  const allFeatures = definition.selectedExample
    ? [...definition.features, definition.selectedExample]
    : definition.features

  // Custom integrations disabled until stable launch
  const chosenAddOns = await resolveAddOns(allFeatures, [], frameworkId)

  const { environment, output } = createMemoryEnvironment(
    `/project/${definition.name}`,
  )

  // Custom starters disabled until stable launch
  await createApp(environment, {
    projectName: definition.name,
    targetDir: `/project/${definition.name}`,
    framework,
    mode: DEFAULT_MODE,
    typescript: true,
    tailwind: definition.tailwind ?? true,
    packageManager: 'pnpm',
    git: false,
    install: false,
    chosenAddOns,
    addOnOptions: mergeOptionsWithDefaults(chosenAddOns, definition.featureOptions),
  })

  const packageJson = output.files['package.json']
    ? JSON.parse(output.files['package.json'])
    : { dependencies: {}, devDependencies: {}, scripts: {} }

  return {
    files: options.format === 'summary' ? {} : output.files,
    packages: {
      dependencies: packageJson.dependencies || {},
      devDependencies: packageJson.devDependencies || {},
      scripts: packageJson.scripts || {},
    },
    envVars: extractEnvVars(chosenAddOns),
    commands: output.commands,
    warnings: extractWarnings(chosenAddOns),
  }
}

// Line attribution interface (used by the UI)
export interface LineAttribution {
  lineNumber: number
  featureId: string
  featureName: string
  type?: 'original' | 'injected'
}

export interface AttributedFile {
  path: string
  content: string
  attributions: Array<LineAttribution>
}

export interface AttributedCompileOutput extends CompileResponse {
  attributedFiles: Record<string, AttributedFile>
  dependencies?: Array<{
    name: string
    version: string
    type: 'dependency' | 'devDependency'
    sourceId: string
    sourceName: string
  }>
}

export async function compileWithAttributionHandler(
  definition: ProjectDefinition,
): Promise<AttributedCompileOutput> {
  const frameworkId = definition.framework ?? 'react-cra'
  const framework = getFramework(frameworkId)

  // Merge selectedExample into features (CTA treats examples as add-ons)
  const allFeatures = definition.selectedExample
    ? [...definition.features, definition.selectedExample]
    : definition.features

  // Custom integrations disabled until stable launch
  const chosenAddOns = await resolveAddOns(allFeatures, [], frameworkId)

  const { environment, output } = createMemoryEnvironment(
    `/project/${definition.name}`,
  )

  // Custom starters disabled until stable launch
  await createApp(environment, {
    projectName: definition.name,
    targetDir: `/project/${definition.name}`,
    framework,
    mode: DEFAULT_MODE,
    typescript: true,
    tailwind: definition.tailwind ?? true,
    packageManager: 'pnpm',
    git: false,
    install: false,
    chosenAddOns,
    addOnOptions: mergeOptionsWithDefaults(chosenAddOns, definition.featureOptions),
  })

  const packageJson = output.files['package.json']
    ? JSON.parse(output.files['package.json'])
    : { dependencies: {}, devDependencies: {}, scripts: {} }

  // Compute attribution using the new cta-engine attribution system
  const attribution = await computeAttribution({
    framework,
    chosenAddOns,
    starter: undefined,
    files: output.files,
  })

  // Convert cta-engine attribution format to our UI format
  // Baseline sources (framework + required addons) get mapped to 'base'
  const baselineSourceIds = new Set([frameworkId, ...DEFAULT_REQUIRED_ADDONS])
  const attributedFiles: Record<string, AttributedFile> = {}

  for (const [filePath, ctaFile] of Object.entries(attribution.attributedFiles)) {
    const file = ctaFile as CtaAttributedFile
    attributedFiles[filePath] = {
      path: filePath,
      content: file.content,
      attributions: file.lineAttributions.map((attr: CtaLineAttribution) => {
        const isBaseline = baselineSourceIds.has(attr.sourceId)
        return {
          lineNumber: attr.line,
          featureId: isBaseline ? 'base' : attr.sourceId,
          featureName: isBaseline ? 'Base Template' : attr.sourceName,
          type: attr.type,
        }
      }),
    }
  }

  // For files that weren't in the attribution (e.g., generated files), use base attribution
  for (const [filePath, content] of Object.entries(output.files)) {
    if (!attributedFiles[filePath]) {
      const lines = (content as string).split('\n')
      attributedFiles[filePath] = {
        path: filePath,
        content: content as string,
        attributions: lines.map((_, i) => ({
          lineNumber: i + 1,
          featureId: 'base',
          featureName: 'Base Template',
          type: 'original' as const,
        })),
      }
    }
  }

  return {
    files: output.files,
    packages: {
      dependencies: packageJson.dependencies || {},
      devDependencies: packageJson.devDependencies || {},
      scripts: packageJson.scripts || {},
    },
    envVars: extractEnvVars(chosenAddOns),
    commands: output.commands,
    warnings: extractWarnings(chosenAddOns),
    attributedFiles,
    dependencies: attribution.dependencies,
  }
}
