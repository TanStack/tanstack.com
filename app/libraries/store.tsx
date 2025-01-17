import { VscPreview, VscWand } from 'react-icons/vsc'
import { Library } from '.'
import { FaGithub, FaBolt, FaCogs } from 'react-icons/fa'
import { BiBookAlt } from 'react-icons/bi'
import { twMerge } from 'tailwind-merge'

const repo = 'tanstack/store'

const textStyles = 'text-twine-600 dark:text-twine-500'

export const storeProject = {
  id: 'store',
  name: 'TanStack Store',
  cardStyles: `shadow-xl shadow-twine-700/20 dark:shadow-lg dark:shadow-twine-500/20 text-twine-500 dark:text-twine-400 border-2 border-transparent hover:border-current`,
  to: '/store',
  tagline: `Framework agnostic data store with reactive framework adapters`,
  description: `The immutable-reactive data store that powers the core of TanStack libraries and their framework adapters.`,
  ogImage: 'https://github.com/tanstack/store/raw/main/media/repo-header.png',
  badge: undefined,
  bgStyle: 'bg-twine-700',
  textStyle: 'text-twine-500',
  repo,
  latestBranch: 'main',
  latestVersion: 'v0',
  availableVersions: ['v0'],
  colorFrom: 'from-twine-500',
  colorTo: 'to-twine-700',
  textColor: 'text-twine-700',
  frameworks: ['react', 'solid', 'svelte', 'vue', 'angular'],
  scarfId: '302d0fef-cb3f-43c6-b45c-f055b9745edb',
  defaultDocs: 'overview',
  menu: [
    {
      icon: <VscPreview />,
      label: 'Examples',
      to: '/store/latest/docs/framework/react/examples/simple',
    },
    {
      icon: <BiBookAlt />,
      label: 'Docs',
      to: '/store/latest/docs',
    },
    {
      icon: <FaGithub />,
      label: 'Github',
      to: `https://github.com/${repo}`,
    },
  ],
  featureHighlights: [
    {
      title: 'Intuitive Configuration',
      icon: <VscWand className={twMerge(textStyles)} />,
      description: (
        <div>
          TanStack Store offers a seamless and intuitive configuration
          management system that simplifies the process of building and
          publishing high-quality JavaScript packages. TanStack Store{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            streamlines the configuration process, allowing developers to focus
            on writing code
          </span>{' '}
          without the hassle of intricate setup procedures.
        </div>
      ),
    },
    {
      title: 'Vite-Powered Builds',
      icon: <FaBolt className={twMerge(textStyles)} />,
      description: (
        <div>
          TanStack Store's build configuration harnesses the Vite ecosystem.
          Customize and extend your build workflows with ease, tailoring them to
          meet the unique requirements of your project.{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            Whether you need advanced optimizations, pre-processors, or other
            specialized tools,
          </span>{' '}
          TanStack Store provides a robust foundation for crafting a build
          pipeline that suits your specific needs.
        </div>
      ),
    },
    {
      title: 'Effortless Publication',
      icon: <FaCogs className={twMerge(textStyles)} />,
      description: (
        <div>
          Say goodbye to the complexities of code publishing. This package
          provides tools designed to automate the publication of your projects.
          Developers can effortlessly publish updates, manage versioning, and
          release on npm and GitHub.{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            TanStack Store takes care of the tedious aspects of package
            publishing,
          </span>{' '}
          empowering developers to share their work with the community
          efficiently.
        </div>
      ),
    },
  ],
} satisfies Library
