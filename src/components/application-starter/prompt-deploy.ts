const starterPromptBuildProductLabels = {
  lovable: 'Lovable',
  netlify: 'Netlify',
  v0: 'v0',
}

export type StarterPromptDeployProvider =
  keyof typeof starterPromptBuildProductLabels

export function buildStarterPromptDeployUrl(
  provider: StarterPromptDeployProvider,
  prompt: string,
) {
  switch (provider) {
    case 'lovable': {
      const url = new URL('https://lovable.dev/')

      url.searchParams.set('autosubmit', 'true')
      url.searchParams.set('utm_source', 'tanstack')
      url.hash = `prompt=${encodeURIComponent(prompt)}`

      return url.toString()
    }
    case 'netlify': {
      const url = new URL('https://app.netlify.com/start')

      url.searchParams.set('prompt', prompt)
      url.searchParams.set('utm_source', 'tanstack')

      return url.toString()
    }
    case 'v0': {
      const url = new URL('https://v0.app/')

      url.searchParams.set('q', prompt)
      url.searchParams.set('utm_source', 'tanstack')

      return url.toString()
    }
  }
}

export function getStarterPromptBuildLabel(
  provider: StarterPromptDeployProvider,
) {
  return `Build with ${starterPromptBuildProductLabels[provider]}`
}
