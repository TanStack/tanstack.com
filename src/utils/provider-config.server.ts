/**
 * Provider Configuration Utilities
 *
 * Functions for injecting provider-specific configuration into example projects.
 * This enables 1-click deploys to Cloudflare, Netlify, Railway, etc.
 */

import {
  addOn as reactCloudflareAddOn,
  renderManifestTemplate as renderReactCloudflareTemplate,
} from '@tanstack/create/worker-manifest/frameworks/react/add-ons/cloudflare'
import {
  addOn as reactNetlifyAddOn,
  renderManifestTemplate as renderReactNetlifyTemplate,
} from '@tanstack/create/worker-manifest/frameworks/react/add-ons/netlify'
import {
  addOn as reactRailwayAddOn,
  renderManifestTemplate as renderReactRailwayTemplate,
} from '@tanstack/create/worker-manifest/frameworks/react/add-ons/railway'
import {
  addOn as solidCloudflareAddOn,
  renderManifestTemplate as renderSolidCloudflareTemplate,
} from '@tanstack/create/worker-manifest/frameworks/solid/add-ons/cloudflare'
import {
  addOn as solidNetlifyAddOn,
  renderManifestTemplate as renderSolidNetlifyTemplate,
} from '@tanstack/create/worker-manifest/frameworks/solid/add-ons/netlify'
import {
  addOn as solidRailwayAddOn,
  renderManifestTemplate as renderSolidRailwayTemplate,
} from '@tanstack/create/worker-manifest/frameworks/solid/add-ons/railway'
import type { WorkerAddOnManifestModule } from '@tanstack/create/worker'
import { parseDocument } from 'yaml'

export type DeployProvider = 'cloudflare' | 'netlify' | 'railway'
type StartFramework = 'react' | 'solid'
type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun' | 'deno'
type PackageAdditions = NonNullable<
  WorkerAddOnManifestModule['addOn']['packageAdditions']
>
type DeploymentTemplateContext = Parameters<
  typeof renderReactCloudflareTemplate
>[1]

type ViteIntegration = {
  type?: string
  import?: string
  code?: string
}

type DeploymentManifest = {
  files: Record<string, string>
  deletedFiles?: ReadonlyArray<string>
  integrations?: ReadonlyArray<ViteIntegration>
  packageAdditions?: PackageAdditions
  packageTemplate?: string
}

type DeploymentManifestModule = {
  addOn: DeploymentManifest
  renderManifestTemplate:
    | typeof renderReactCloudflareTemplate
    | typeof renderReactNetlifyTemplate
    | typeof renderReactRailwayTemplate
    | typeof renderSolidCloudflareTemplate
    | typeof renderSolidNetlifyTemplate
    | typeof renderSolidRailwayTemplate
}

interface ProviderConfigResult {
  files: Record<string, string>
  deletedFiles: ReadonlyArray<string>
  packageAdditions: PackageAdditions
  viteIntegration: ViteIntegration | undefined
}

function defineDeploymentManifestModule(
  module: DeploymentManifestModule,
): DeploymentManifestModule {
  return module
}

const deploymentManifestModules = {
  react: {
    cloudflare: defineDeploymentManifestModule({
      addOn: reactCloudflareAddOn,
      renderManifestTemplate: renderReactCloudflareTemplate,
    }),
    netlify: defineDeploymentManifestModule({
      addOn: reactNetlifyAddOn,
      renderManifestTemplate: renderReactNetlifyTemplate,
    }),
    railway: defineDeploymentManifestModule({
      addOn: reactRailwayAddOn,
      renderManifestTemplate: renderReactRailwayTemplate,
    }),
  },
  solid: {
    cloudflare: defineDeploymentManifestModule({
      addOn: solidCloudflareAddOn,
      renderManifestTemplate: renderSolidCloudflareTemplate,
    }),
    netlify: defineDeploymentManifestModule({
      addOn: solidNetlifyAddOn,
      renderManifestTemplate: renderSolidNetlifyTemplate,
    }),
    railway: defineDeploymentManifestModule({
      addOn: solidRailwayAddOn,
      renderManifestTemplate: renderSolidRailwayTemplate,
    }),
  },
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasDependency(packageJson: unknown, dependency: string): boolean {
  if (!isObject(packageJson)) return false

  return [packageJson.dependencies, packageJson.devDependencies].some(
    (dependencies) => isObject(dependencies) && dependency in dependencies,
  )
}

/**
 * Get the TanStack Start framework used by an example from package.json.
 */
export function getStartFramework(
  files: Record<string, string>,
): StartFramework | null {
  const packageJson = files['package.json']
  if (!packageJson) return null

  try {
    const parsedPackageJson: unknown = JSON.parse(packageJson)

    if (hasDependency(parsedPackageJson, '@tanstack/solid-start')) {
      return 'solid'
    }

    if (hasDependency(parsedPackageJson, '@tanstack/react-start')) {
      return 'react'
    }

    return null
  } catch {
    return null
  }
}

/**
 * Check if an example is a TanStack Start app by looking at package.json
 */
export function isStartApp(files: Record<string, string>): boolean {
  return getStartFramework(files) !== null
}

/**
 * Get provider-specific configuration files and dependencies
 */
export function getProviderConfig(
  provider: DeployProvider,
  projectName: string,
  framework: StartFramework,
  sourceFiles: Record<string, string> = {},
): ProviderConfigResult {
  const manifestModule = deploymentManifestModules[framework][provider]
  const { addOn } = manifestModule
  const files = getManifestFiles(addOn, provider, projectName)
  let packageAdditions = addOn.packageAdditions ?? {}

  if (addOn.packageTemplate) {
    const renderedPackageTemplate = manifestModule.renderManifestTemplate(
      addOn.packageTemplate,
      getDeploymentTemplateContext(sourceFiles, projectName),
    )

    packageAdditions = parsePackageAdditions(renderedPackageTemplate)
  }

  return {
    files,
    deletedFiles: addOn.deletedFiles ?? [],
    packageAdditions,
    viteIntegration: addOn.integrations?.find(
      (integration) =>
        integration.type === 'vite-plugin' &&
        integration.import !== undefined &&
        integration.code !== undefined,
    ),
  }
}

function getManifestFiles(
  manifest: DeploymentManifest,
  provider: DeployProvider,
  projectName: string,
): Record<string, string> {
  const files = { ...manifest.files }
  const wranglerConfig = files['wrangler.jsonc']

  if (provider === 'cloudflare' && wranglerConfig) {
    const parsedWranglerConfig: unknown = JSON.parse(wranglerConfig)
    if (!isObject(parsedWranglerConfig)) {
      throw new Error(
        'Create Cloudflare manifest has an invalid wrangler.jsonc',
      )
    }

    files['wrangler.jsonc'] = JSON.stringify(
      {
        ...parsedWranglerConfig,
        name: sanitizeProjectName(projectName),
      },
      null,
      2,
    )
  }

  return files
}

function getDeploymentTemplateContext(
  files: Record<string, string>,
  projectName: string,
): DeploymentTemplateContext {
  return {
    packageManager: getProjectPackageManager(files),
    projectName,
    typescript: true,
    tailwind: false,
    blank: false,
    js: 'ts',
    jsx: 'tsx',
    fileRouter: true,
    codeRouter: false,
    routerOnly: false,
    includeExamples: true,
    addOnEnabled: {
      sentry: hasCompleteSentrySetup(files),
    },
    addOnOption: {},
    addOns: [],
    integrations: [],
    routes: [],
    getPackageManagerAddScript: () => '',
    getPackageManagerRunScript: () => '',
    getPackageManagerExecuteScript: () => '',
    relativePath: () => '',
    integrationImportContent: () => '',
    integrationImportCode: () => undefined,
    renderTemplate: (content) => content,
    ignoreFile() {
      throw new Error('Package templates cannot ignore files')
    },
  }
}

function getProjectPackageManager(
  files: Record<string, string>,
): PackageManager {
  const packageJson = parsePackageJson(files['package.json'])
  if (isObject(packageJson) && typeof packageJson.packageManager === 'string') {
    const packageManagerName = packageJson.packageManager.split('@')[0]
    if (isPackageManager(packageManagerName)) {
      return packageManagerName
    }
  }

  if ('pnpm-lock.yaml' in files) return 'pnpm'
  if ('yarn.lock' in files) return 'yarn'
  if ('bun.lock' in files || 'bun.lockb' in files) return 'bun'
  if ('deno.lock' in files) return 'deno'
  return 'npm'
}

function isPackageManager(value: string): value is PackageManager {
  return ['npm', 'yarn', 'pnpm', 'bun', 'deno'].includes(value)
}

function parsePackageJson(content: string | undefined): unknown {
  if (!content) return undefined

  try {
    return JSON.parse(content)
  } catch {
    return undefined
  }
}

function hasCompleteSentrySetup(files: Record<string, string>): boolean {
  const packageJson = parsePackageJson(files['package.json'])
  if (
    !hasDependency(packageJson, '@sentry/tanstackstart-react') ||
    !('instrument.server.mjs' in files) ||
    !isObject(packageJson) ||
    !isObject(packageJson.scripts) ||
    typeof packageJson.scripts.build !== 'string'
  ) {
    return false
  }

  return packageJson.scripts.build.includes(
    'cp instrument.server.mjs .output/server',
  )
}

function parsePackageAdditions(content: string | undefined): PackageAdditions {
  if (!content) return {}

  const parsedPackageAdditions: unknown = JSON.parse(content)
  if (!isObject(parsedPackageAdditions)) {
    throw new Error('Create deployment manifest has invalid package additions')
  }

  return {
    dependencies: getStringRecord(parsedPackageAdditions.dependencies),
    devDependencies: getStringRecord(parsedPackageAdditions.devDependencies),
    engines: getStringRecord(parsedPackageAdditions.engines),
    pnpm: getPnpmConfig(parsedPackageAdditions.pnpm),
    scripts: getStringRecord(parsedPackageAdditions.scripts),
  }
}

function getStringRecord(value: unknown): Record<string, string> | undefined {
  if (!isObject(value)) return undefined

  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  )
  return entries.length ? Object.fromEntries(entries) : undefined
}

function getStringArray(value: unknown): Array<string> {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string')
}

function getPnpmConfig(value: unknown): PackageAdditions['pnpm'] {
  if (!isObject(value)) return undefined

  const onlyBuiltDependencies = value.onlyBuiltDependencies
  if (
    !Array.isArray(onlyBuiltDependencies) ||
    !onlyBuiltDependencies.every(
      (dependency): dependency is string => typeof dependency === 'string',
    )
  ) {
    return undefined
  }

  return { onlyBuiltDependencies }
}

/**
 * Sanitize project name for use in configs (lowercase, hyphens only)
 */
function sanitizeProjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Apply provider configuration to a set of files
 *
 * This merges provider-specific config files and updates package.json
 * with necessary dependencies and scripts.
 *
 * For Start apps: applies full server-side provider config
 * For non-Start apps (SPAs): applies static site config
 */
export function applyProviderConfig(
  files: Record<string, string>,
  provider: DeployProvider,
  projectName: string,
): Record<string, string> {
  const framework = getStartFramework(files)
  const result = { ...files }

  if (framework) {
    // Full server-side config for Start apps
    console.log(
      '[applyProviderConfig] Start app, applying full provider config',
    )
    const config = getProviderConfig(provider, projectName, framework, result)

    // Add provider-specific config files
    for (const [path, content] of Object.entries(config.files)) {
      result[path] = content
    }

    for (const path of config.deletedFiles) {
      delete result[path]
    }

    // Update package.json with dependencies and scripts
    if (result['package.json']) {
      result['package.json'] = updatePackageJson(
        result['package.json'],
        config.packageAdditions,
      )
    }

    const pnpmBuildDependencies =
      config.packageAdditions.pnpm?.onlyBuiltDependencies ?? []
    if (
      getProjectPackageManager(result) === 'pnpm' &&
      pnpmBuildDependencies.length
    ) {
      result['pnpm-workspace.yaml'] = updatePnpmWorkspace(
        result['pnpm-workspace.yaml'],
        pnpmBuildDependencies,
      )
    }

    // Update vite.config.ts with provider plugin
    const viteConfigPath = findViteConfig(result)
    if (viteConfigPath) {
      result[viteConfigPath] = updateViteConfig(
        result[viteConfigPath],
        config.viteIntegration,
      )
    }
  } else {
    // Static site config for SPAs
    console.log('[applyProviderConfig] SPA, applying static site config')
    const config = getStaticSiteConfig(provider)

    // Add static site config files
    for (const [path, content] of Object.entries(config.files)) {
      result[path] = content
    }
  }

  return result
}

/**
 * Get static site configuration for non-Start apps (SPAs)
 */
function getStaticSiteConfig(provider: DeployProvider): {
  files: Record<string, string>
} {
  switch (provider) {
    case 'cloudflare': {
      // Cloudflare Pages config for static sites
      // Uses _headers and _redirects files for SPA routing
      const redirects = `/*    /index.html   200`
      return {
        files: {
          'public/_redirects': redirects,
        },
      }
    }

    case 'netlify': {
      // Netlify static site config
      const netlifyToml = `[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`
      return {
        files: {
          'netlify.toml': netlifyToml,
        },
      }
    }

    case 'railway': {
      // Railway can serve static files, needs a simple config
      // Uses nixpacks which auto-detects Vite projects
      const nixpacksToml = `[phases.build]
cmds = ["npm install", "npm run build"]

[phases.setup]
nixPkgs = ["nodejs_22"]

[start]
cmd = "npx serve dist -s -l 3000"
`
      return {
        files: {
          'nixpacks.toml': nixpacksToml,
        },
      }
    }

    default:
      return { files: {} }
  }
}

/**
 * Find the vite config file in the project
 */
function findViteConfig(files: Record<string, string>): string | null {
  const candidates = ['vite.config.ts', 'vite.config.js', 'vite.config.mts']
  return candidates.find((path) => path in files) ?? null
}

/**
 * Update package.json with provider-specific dependencies and scripts
 */
function updatePackageJson(
  content: string,
  packageAdditions: PackageAdditions,
): string {
  const parsedPackageJson = parsePackageJson(content)
  if (!isObject(parsedPackageJson)) return content

  const packageJson = { ...parsedPackageJson }

  packageJson.dependencies = {
    ...getStringRecord(packageJson.dependencies),
    ...packageAdditions.dependencies,
  }
  packageJson.devDependencies = {
    ...getStringRecord(packageJson.devDependencies),
    ...packageAdditions.devDependencies,
  }
  packageJson.scripts = {
    ...getStringRecord(packageJson.scripts),
    ...packageAdditions.scripts,
  }

  if (packageAdditions.engines) {
    packageJson.engines = {
      ...getStringRecord(packageJson.engines),
      ...packageAdditions.engines,
    }
  }

  const existingPnpm = isObject(packageJson.pnpm) ? packageJson.pnpm : undefined
  const existingOnlyBuiltDependencies = getStringArray(
    existingPnpm?.onlyBuiltDependencies,
  )
  const addedOnlyBuiltDependencies =
    packageAdditions.pnpm?.onlyBuiltDependencies ?? []
  const onlyBuiltDependencies = [
    ...new Set([
      ...existingOnlyBuiltDependencies,
      ...addedOnlyBuiltDependencies,
    ]),
  ]

  if (existingPnpm || packageAdditions.pnpm) {
    const pnpm: Record<string, unknown> = {
      ...existingPnpm,
      ...packageAdditions.pnpm,
    }
    if (onlyBuiltDependencies.length) {
      pnpm.onlyBuiltDependencies = onlyBuiltDependencies
    }
    packageJson.pnpm = pnpm
  }

  return JSON.stringify(packageJson, null, 2)
}

function updatePnpmWorkspace(
  content: string | undefined,
  buildDependencies: ReadonlyArray<string>,
): string {
  const document = parseDocument(content ?? '')
  if (document.errors.length) {
    throw new Error('Cannot update an invalid pnpm-workspace.yaml')
  }

  for (const dependency of buildDependencies) {
    try {
      document.setIn(['allowBuilds', dependency], true)
    } catch {
      throw new Error(
        'pnpm-workspace.yaml must define allowBuilds as a mapping',
      )
    }
  }

  return document.toString()
}

/**
 * Update vite.config.ts with provider-specific plugin
 */
function updateViteConfig(
  content: string,
  integration: ViteIntegration | undefined,
): string {
  let result = content
  if (!integration?.import || !integration.code) {
    return result
  }

  if (!hasEquivalentImport(result, integration.import)) {
    const lastImportIndex = findLastImportIndex(result)
    result =
      result.slice(0, lastImportIndex) +
      `${integration.import}\n` +
      result.slice(lastImportIndex)
  }

  const pluginName = getPluginName(integration.code)
  if (pluginName) {
    result = upsertPluginCall(result, pluginName, integration.code)
  }

  return result
}

function normalizeImportStatement(importStatement: string): string {
  return importStatement
    .trim()
    .replace(/;$/, '')
    .replaceAll('"', "'")
    .replace(/\s+/g, ' ')
    .replace(/\s*([{},])\s*/g, '$1')
}

function hasEquivalentImport(
  content: string,
  importStatement: string,
): boolean {
  const normalizedImport = normalizeImportStatement(importStatement)
  const existingImports = content.match(/^import\s.+$/gm) ?? []
  return existingImports.some(
    (existingImport) =>
      normalizeImportStatement(existingImport) === normalizedImport,
  )
}

function getPluginName(pluginCall: string): string | undefined {
  return /^([A-Za-z_$][\w$]*)\s*\(/.exec(pluginCall)?.[1]
}

function hasPluginCall(content: string, pluginName: string) {
  return new RegExp(`\\b${pluginName}\\s*\\(`).test(content)
}

function upsertPluginCall(
  content: string,
  pluginName: string,
  pluginCall: string,
): string {
  const emptyPluginCall = new RegExp(`\\b${pluginName}\\s*\\(\\s*\\)`)
  if (emptyPluginCall.test(content)) {
    return content.replace(emptyPluginCall, pluginCall)
  }

  if (hasPluginCall(content, pluginName)) {
    return content
  }

  return addPluginToConfig(content, pluginCall)
}

/**
 * Find the index after the last import statement
 */
function findLastImportIndex(content: string): number {
  const importRegex = /^import\s.+$/gm
  let lastIndex = 0
  let match

  while ((match = importRegex.exec(content)) !== null) {
    lastIndex = match.index + match[0].length + 1
  }

  return lastIndex || 0
}

/**
 * Add a plugin to the plugins array in vite config
 */
function addPluginToConfig(content: string, pluginCall: string): string {
  // Look for plugins: [ pattern
  const pluginsRegex = /plugins\s*:\s*\[/

  const match = pluginsRegex.exec(content)
  if (!match) {
    return content
  }

  // Insert the plugin after the opening bracket
  const insertIndex = match.index + match[0].length
  return (
    content.slice(0, insertIndex) +
    `\n    ${pluginCall},` +
    content.slice(insertIndex)
  )
}

/**
 * Generate a description for the deployed repo
 */
export function generateExampleDescription(
  libraryName: string,
  exampleName: string,
  provider: DeployProvider,
): string {
  const providerNames: Record<DeployProvider, string> = {
    cloudflare: 'Cloudflare',
    netlify: 'Netlify',
    railway: 'Railway',
  }

  return `${libraryName} example: ${exampleName} (configured for ${providerNames[provider]})`
}
