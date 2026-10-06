import { type Framework } from '~/libraries'

export function getExampleSandboxUrls({
  repo,
  branch,
  examplePath,
  file,
  isDark,
}: {
  repo: string
  branch: string
  examplePath: string
  file: string
  isDark: boolean
}) {
  const path = `${repo}/tree/${branch}/examples/${examplePath}`
  const search = new URLSearchParams({
    embed: '1',
    theme: isDark ? 'dark' : 'light',
    file,
  })
  return {
    stackBlitzUrl: `https://stackblitz.com/github/${path}?${search}&preset=node`,
    codeSandboxUrl: `https://codesandbox.io/p/devbox/github/${path}?${search}`,
  }
}

export const getExampleStartingPath = (
  framework: Framework,
  libraryId?: string,
) => {
  if (libraryId === 'start') {
    return 'src/routes/__root.tsx'
  }

  if (libraryId === 'ai') {
    return 'src/routes/index.tsx'
  }

  const dir = framework === 'angular' ? 'src/app' : 'src'

  return `${dir}/${getExampleStartingFileName(framework, libraryId)}` as const
}

export function getExampleStartingFileName(
  framework: Framework,
  libraryId?: string,
) {
  const file =
    framework === 'angular'
      ? 'app.component'
      : ['svelte', 'vue'].includes(framework)
        ? 'App'
        : ['form', 'query', 'pacer', 'hotkeys'].includes(libraryId!)
          ? 'index'
          : 'main'

  const ext =
    framework === 'svelte'
      ? 'svelte'
      : framework === 'vue'
        ? 'vue'
        : framework === 'octane'
          ? 'tsrx'
          : ['angular', 'lit'].includes(framework)
            ? 'ts'
            : 'tsx'

  return `${file}.${ext}` as const
}
