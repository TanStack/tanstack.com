import reactLogo from '~/images/react-logo.svg'
import solidLogo from '~/images/solid-logo.svg'
import vueLogo from '~/images/vue-logo.svg'
import svelteLogo from '~/images/svelte-logo.svg'
import type { AvailableOptions } from '~/components/Select'

export const repo = 'tanstack/virtual'

export const latestBranch = 'main'
export const latestVersion = 'v3'
export const availableVersions = ['v3']

export const colorFrom = 'from-rose-500'
export const colorTo = 'to-violet-600'
export const textColor = 'text-violet-600'

export const frameworks: AvailableOptions = [
  { label: 'React', value: 'react', logo: reactLogo },
  { label: 'Solid', value: 'solid', logo: solidLogo },
  { label: 'Svelte', value: 'svelte', logo: svelteLogo },
  { label: 'Vue', value: 'vue', logo: vueLogo },
]

export type Framework = keyof typeof frameworks

export function getBranch(argVersion?: string) {
  const version = argVersion || latestVersion

  return ['latest', latestVersion].includes(version) ? latestBranch : version
}

// prettier-ignore
export const reactVirtualV2List = [
    {from: 'docs/overview',to: 'docs/introduction',},
    {from: 'docs/installation',to: 'docs/installation',},
    {from: 'docs/api',to: 'docs/api/virtualizer',},
    {from: 'examples/fixed',to: 'docs/framework/react/examples/fixed',},
    {from: 'examples/variable',to: 'docs/framework/react/examples/variable',},
    {from: 'examples/dynamic',to: 'docs/framework/react/examples/dynamic',},
    {from: 'examples/infinite-scroll',to: 'docs/framework/react/examples/infinite-scroll',},
    {from: 'examples/padding',to: 'docs/framework/react/examples/padding',},
    {from: 'examples/smooth-scroll',to: 'docs/framework/react/examples/smooth-scroll',},
    {from: 'examples/sticky',to: 'docs/framework/react/examples/sticky',},
    {from: '',to: '',},
  ]

export const reactVirtualV2ExampleList = []
