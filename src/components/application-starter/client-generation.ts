import {
  getRecipeApplicationStarterFeatures,
  type ApplicationStarterRecipe,
  type ApplicationStarterResult,
} from '~/utils/application-starter'
import type { FrameworkId } from '~/application-starter/frameworks'

const BASE64_PREFIX = 'base64::'

export interface ApplicationStarterProjectInput {
  name: string
  framework?: FrameworkId
  packageManager?: 'bun' | 'npm' | 'pnpm' | 'yarn'
  tailwind?: boolean
  features: Array<string>
  featureOptions: Record<string, Record<string, unknown>>
}

function decodeBase64File(content: string): Uint8Array | null {
  if (!content.startsWith(BASE64_PREFIX)) {
    return null
  }

  const decoded = atob(content.slice(BASE64_PREFIX.length))
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0))
}

function recipeToProjectInput(
  recipe: ApplicationStarterRecipe,
): ApplicationStarterProjectInput {
  return {
    name: recipe.projectName || 'my-tanstack-app',
    framework: recipe.framework,
    packageManager: recipe.packageManager,
    tailwind: recipe.tailwind,
    features: getRecipeApplicationStarterFeatures(recipe),
    featureOptions: recipe.featureOptions,
  }
}

export async function compileApplicationStarterProject(
  input: ApplicationStarterProjectInput,
) {
  if (import.meta.env.SSR) {
    throw new Error(
      'Application Starter project generation is only available in the browser',
    )
  }

  const { compileHandler } = await import('~/application-starter/api/compile')

  const result = await compileHandler({
    name: input.name,
    framework: input.framework,
    packageManager: input.packageManager,
    tailwind: input.tailwind,
    features: input.features,
    featureOptions: input.featureOptions,
  })

  return result.files
}

export async function compileApplicationStarterRecipe(
  recipe: ApplicationStarterRecipe,
) {
  return compileApplicationStarterProject(recipeToProjectInput(recipe))
}

export async function downloadApplicationStarterResult(
  result: ApplicationStarterResult,
) {
  const input = recipeToProjectInput(result.recipe)
  const [files, zipModule] = await Promise.all([
    compileApplicationStarterProject(input),
    import('jszip'),
  ])

  const zip = new zipModule.default()
  const rootFolder = zip.folder(input.name)

  if (!rootFolder) {
    throw new Error('Failed to create ZIP folder')
  }

  for (const [filePath, content] of Object.entries(files)) {
    const binaryContent = decodeBase64File(content)
    if (binaryContent) {
      rootFolder.file(filePath, binaryContent, { binary: true })
    } else {
      rootFolder.file(filePath, content)
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${input.name}.zip`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
