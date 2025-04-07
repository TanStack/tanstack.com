import { type Framework } from '~/libraries'

export const getInitialSandboxFileName = (
  framework: Framework,
  libraryId?: string
) => {
  if (libraryId && ['start', 'router'].includes(libraryId)) {
    return 'src/routes/__root.tsx'
  }

  const dir = framework === 'angular' ? 'src/app' : 'src'

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
      : ['form', 'query', 'pacer'].includes(libraryId!)
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

export const getInitialExplorerFileName = (
  framework: Framework,
  libraryId?: string
) => {
  if (libraryId && ['start', 'router'].includes(libraryId)) {
    return 'src/routes/__root.tsx'
  }

  return getFrameworkStartFileName(framework, libraryId)
}
