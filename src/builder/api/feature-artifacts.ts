import {
  compileWithAttribution,
  fetchIntegrations,
  type IntegrationCompiled,
  type RouterMode,
  type PackageManager,
} from '@tanstack/cli'
import { getAddonsBasePath } from './config'

export interface FeatureArtifactsRequest {
  features: Array<string>
  projectName?: string
  tailwind?: boolean
  featureOptions?: Record<string, Record<string, unknown>>
  customIntegrations?: Array<IntegrationCompiled>
}

export interface FeatureArtifact {
  files: Record<string, string>
  injections: Record<string, { content: string; highlightedLines: Array<number> }>
  packages: {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  envVars?: Array<{
    name: string
    description: string
  }>
}

export interface FeatureArtifactsResponse {
  artifacts: Record<string, FeatureArtifact>
}

export async function featureArtifactsHandler(
  request: FeatureArtifactsRequest,
): Promise<FeatureArtifactsResponse> {
  if (!request.features || request.features.length === 0) {
    return { artifacts: {} }
  }

  const basePath = getAddonsBasePath()
  const projectName = request.projectName || 'my-app'
  const tailwind = request.tailwind ?? true

  const customIds = new Set(
    (request.customIntegrations ?? []).map((i) => i.id),
  )
  const manifestFeatures = request.features.filter((id) => !customIds.has(id))

  const manifestIntegrations =
    manifestFeatures.length > 0
      ? await fetchIntegrations(manifestFeatures, basePath)
      : []

  const allIntegrations = [
    ...manifestIntegrations,
    ...(request.customIntegrations ?? []),
  ]

  // Compile with ALL integrations to get accurate attributions
  const output = compileWithAttribution({
    projectName,
    framework: 'react',
    mode: 'file-router' as RouterMode,
    typescript: true,
    tailwind,
    packageManager: 'pnpm' as PackageManager,
    chosenIntegrations: allIntegrations,
    integrationOptions: request.featureOptions ?? {},
  })

  // Build artifacts per integration from the attributed output
  const artifacts: Record<string, FeatureArtifact> = {}

  // Initialize artifacts for each integration
  for (const integration of allIntegrations) {
    artifacts[integration.id] = {
      files: {},
      injections: {},
      packages: {
        dependencies: integration.packageAdditions?.dependencies,
        devDependencies: integration.packageAdditions?.devDependencies,
      },
      envVars: integration.envVars,
    }
  }

  // Process each file and its attributions
  for (const [path, fileData] of Object.entries(output.attributedFiles)) {
    const content = output.files[path]
    if (!content || !fileData.attributions) continue

    // Group lines by featureId
    const linesByFeature = new Map<string, Array<number>>()
    let hasBaseLines = false

    for (const attr of fileData.attributions) {
      if (attr.featureId === 'base') {
        hasBaseLines = true
        continue
      }
      
      if (!linesByFeature.has(attr.featureId)) {
        linesByFeature.set(attr.featureId, [])
      }
      linesByFeature.get(attr.featureId)!.push(attr.lineNumber)
    }

    // Assign to each integration's artifacts
    for (const [featureId, lines] of linesByFeature) {
      if (!artifacts[featureId]) continue

      if (hasBaseLines) {
        // File has mix of base and integration lines - it's an injection
        artifacts[featureId].injections[path] = {
          content,
          highlightedLines: lines,
        }
      } else {
        // File is entirely from this integration - it's a new file
        // Only add if ALL lines are from this integration
        const allLinesFromThis = fileData.attributions.every(
          (a) => a.featureId === featureId,
        )
        if (allLinesFromThis) {
          artifacts[featureId].files[path] = content
        } else {
          // Multiple integrations contribute to this file
          artifacts[featureId].injections[path] = {
            content,
            highlightedLines: lines,
          }
        }
      }
    }
  }

  return { artifacts }
}
