import { type Framework } from '~/libraries'

export const getInitialSandboxFileName = (
  framework: Framework,
  libraryId?: string
) => {
  if (libraryId === 'start') {
    return 'src/routes/__root.tsx'
  }

  const dir = 'src'

  return `${dir}/${getFrameworkStartFileName(framework, libraryId)}` as const
}

export function getFrameworkStartFileName(
  framework: Framework,
  libraryId?: string
) {
  const file =
    framework === 'angular'
      ? 'app.component'
      : ['svelte', 'vue'].includes(framework)
      ? 'App'
      : ['form', 'query'].includes(libraryId!)
      ? 'index'
      : 'main'

  const ext =
    framework === 'svelte'
      ? 'svelte'
      : framework === 'vue'
      ? 'vue'
      : ['angular', 'lit'].includes(framework)
      ? 'ts'
      : 'tsx'

  return `${file}.${ext}` as const
}

export const getInitialExplorerDirectory = (libraryId: string) => {
  if (['start', 'router'].includes(libraryId!)) {
    return ''
  }

  return '/src'
}
