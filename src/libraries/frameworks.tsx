import reactLogo from '../images/react-logo.svg'
import vueLogo from '../images/vue-logo.svg'
import angularLogo from '../images/angular-logo.svg'
import svelteLogo from '../images/svelte-logo.svg'
import solidLogo from '../images/solid-logo.svg'
import jsLogo from '../images/js-logo.svg'
import type { Framework } from './types'

export const frameworkOptions = [
  { label: 'React', value: 'react', logo: reactLogo, color: 'bg-blue-500' },
  { label: 'Vue', value: 'vue', logo: vueLogo, color: 'bg-green-500' },
  { label: 'Angular', value: 'angular', logo: angularLogo, color: 'bg-red-500' },
  { label: 'Svelte', value: 'svelte', logo: svelteLogo, color: 'bg-orange-500' },
  { label: 'Solid', value: 'solid', logo: solidLogo, color: 'bg-blue-600' },
  { label: 'Vanilla', value: 'vanilla', logo: jsLogo, color: 'bg-yellow-500' },
] as const

export function getFrameworkOptions(frameworkStrs: Framework[]) {
  return frameworkOptions.filter((d) => frameworkStrs.includes(d.value))
}

