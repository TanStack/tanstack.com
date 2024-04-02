import { CgCornerUpLeft, CgSpinner } from 'react-icons/cg'
import {
  FaBolt,
  FaBook,
  FaCheckCircle,
  FaCogs,
  FaDiscord,
  FaGithub,
  FaTshirt,
} from 'react-icons/fa'
import { Carbon } from '~/components/Carbon'
import { Footer } from '~/components/Footer'
import { VscPreview, VscWand } from 'react-icons/vsc'
import { TbHeartHandshake } from 'react-icons/tb'
import SponsorPack from '~/components/SponsorPack'
import { configProject } from '~/projects/config'
import {
  Await,
  Link,
  createFileRoute,
  getRouteApi,
} from '@tanstack/react-router'
import { seo } from '~/utils/seo'

const menu = [
  {
    label: (
      <div className="flex items-center gap-2">
        <CgCornerUpLeft className="text-lg" /> TanStack
      </div>
    ),
    to: '/',
  },
  {
    label: (
      <div className="flex items-center gap-1">
        <VscPreview className="text-lg" /> Examples
      </div>
    ),
    to: './docs/framework/react/examples/simple',
  },
  {
    label: (
      <div className="flex items-center gap-1">
        <FaBook className="text-lg" /> Docs
      </div>
    ),
    to: './docs/',
  },
  {
    label: (
      <div className="flex items-center gap-1">
        <FaGithub className="text-lg" /> GitHub
      </div>
    ),
    to: `https://github.com/${configProject.repo}`,
  },
  {
    label: (
      <div className="flex items-center gap-1">
        <FaDiscord className="text-lg" /> Discord
      </div>
    ),
    to: 'https://tlinz.com/discord',
  },
  {
    label: (
      <div className="flex items-center gap-1">
        <FaTshirt className="text-lg" /> Merch
      </div>
    ),
    to: `https://cottonbureau.com/people/tanstack`,
  },
]

export const Route = createFileRoute('/_libraries/config/$version/')({
  component: FormVersionIndex,
  meta: () =>
    seo({
      title: configProject.name,
      description: configProject.description,
    }),
})

const librariesRouteApi = getRouteApi('/_libraries')

export default function FormVersionIndex() {
  const { sponsorsPromise } = librariesRouteApi.useLoaderData()
  const { version } = Route.useParams()
  // const branch = getBranch(version)
  // const [isDark, setIsDark] = React.useState(true)

  // React.useEffect(() => {
  //   setIsDark(window.matchMedia?.(`(prefers-color-scheme: dark)`).matches)
  // }, [])

  const gradientText = `inline-block text-transparent bg-clip-text bg-gradient-to-r ${configProject.colorFrom} ${configProject.colorTo}`

  return (
    <>
      <div className="flex flex-col gap-20 md:gap-32">
        <div
          className="flex flex-wrap py-2 px-4 items-center justify-center text-sm max-w-screen-xl mx-auto
          md:text-base md:self-end"
        >
          {menu?.map((item, i) => {
            const label = (
              <div className="p-2 opacity-90 hover:opacity-100">
                {item.label}
              </div>
            )

            return (
              <div key={i} className="hover:underline">
                {item.to.startsWith('http') ? (
                  <a href={item.to}>{label}</a>
                ) : (
                  <Link to={item.to}>{label}</Link>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex flex-col items-center gap-8 text-center px-4">
          <div className="flex gap-2 lg:gap-4 items-center">
            <h1
              className={`inline-block
            font-black text-4xl
            md:text-6xl
            lg:text-7xl`}
            >
              <span className={gradientText}>TanStack Config</span>{' '}
              <span
                className="text-[.5em] align-super text-black animate-bounce
              dark:text-white"
              >
                {version === 'latest' ? configProject.latestVersion : version}
              </span>
            </h1>
          </div>
          <h2
            className="font-bold text-2xl max-w-[600px]
            md:text-3xl
            lg:text-5xl lg:max-w-[800px]"
          >
            <span className="underline decoration-dashed decoration-gray-500 decoration-3 underline-offset-2">
              Configuration and tools
            </span>{' '}
            for publishing and maintaining high-quality JavaScript packages
          </h2>
          <Link
            to="./docs/"
            className={`py-2 px-4 bg-gray-500 text-white rounded uppercase font-extrabold`}
          >
            Get Started
          </Link>
        </div>
        <div
          className="text-lg flex flex-col gap-12 p-8 max-w-[1200px] mx-auto
                        md:flex-row"
        >
          <div className="flex-1 flex flex-col gap-8 items-center">
            <VscWand className="text-gray-400 text-6xl" />
            <div className="flex flex-col gap-4">
              <h3 className="uppercase text-center text-xl font-black">
                Intuitive Configuration
              </h3>
              <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
                TanStack Config offers a seamless and intuitive configuration
                management system that simplifies the process of building and
                publishing high-quality JavaScript packages. TanStack Config{' '}
                <span className="font-semibold text-gray-700 dark:text-gray-500">
                  streamlines the configuration process, allowing developers to
                  focus on writing code
                </span>{' '}
                without the hassle of intricate setup procedures.
              </p>
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-8 items-center">
            <div className="text-center">
              <FaBolt className="text-gray-500 text-6xl" />
            </div>
            <div className="flex flex-col gap-4">
              <h3 className="uppercase text-center text-xl font-black">
                Vite-Powered Builds
              </h3>
              <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
                TanStack Config's build configuration harnesses the Vite
                ecosystem. Customize and extend your build workflows with ease,
                tailoring them to meet the unique requirements of your project.{' '}
                <span className="font-semibold text-gray-700 dark:text-gray-500">
                  Whether you need advanced optimizations, pre-processors, or
                  other specialized tools,
                </span>{' '}
                TanStack Config provides a robust foundation for crafting a
                build pipeline that suits your specific needs.
              </p>
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-8 items-center">
            <div className="text-center">
              <FaCogs className="text-gray-700 text-6xl" />
            </div>
            <div className="flex flex-col gap-4">
              <h3 className="uppercase text-center text-xl font-black">
                Effortless Publication
              </h3>

              <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
                Say goodbye to the complexities of code publishing. This package
                provides tools designed to automate the publication of your
                projects. Developers can effortlessly publish updates, manage
                versioning, and release on npm and GitHub.{' '}
                <span className="font-semibold text-gray-700 dark:text-gray-500">
                  TanStack Config takes care of the tedious aspects of package
                  publishing,
                </span>{' '}
                empowering developers to share their work with the community
                efficiently.
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-8 mx-auto container">
          <div className=" sm:text-center pb-16">
            <h3 className="text-3xl text-center mx-auto leading-tight font-extrabold tracking-tight sm:text-4xl lg:leading-none mt-2">
              Hassle-Free Setup
            </h3>
            <p className="mt-4 text-xl max-w-3xl mx-auto leading-7 opacity-60">
              Incorporate TanStack Config into your development toolkit and
              experience a new level of efficiency, speed, and customization in
              building and releasing high-quality JavaScript packages.
            </p>
          </div>
          <div className="grid grid-flow-row grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-4 w-[max-content] mx-auto">
            {[
              // A list of features that @tanstack/config provides
              'Vite ecosystem',
              'Opinionated defaults',
              'Publint-compliant',
              'Minimal configuration',
              'Package versioning',
              'Automated changelogs',
            ].map((d, i) => {
              return (
                <span key={i} className="flex items-center gap-2">
                  <FaCheckCircle className="text-green-500 " /> {d}
                </span>
              )
            })}
          </div>
        </div>

        <div className="px-4 w-[500px] max-w-full mx-auto">
          <h3 className="text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-8">
            Partners
          </h3>
          <div className="h-8" />
          <div
            className="flex-1 flex flex-col items-center text-sm text-center
                      bg-white shadow-xl shadow-gray-500/20 rounded-lg
                        divide-y-2 divide-gray-500 divide-opacity-10 overflow-hidden
                        dark:bg-gray-800 dark:shadow-none"
          >
            <span className="flex items-center gap-2 p-12 text-4xl text-rose-500 font-black uppercase">
              Config <TbHeartHandshake /> You?
            </span>
            <div className="flex flex-col p-4 gap-4">
              <div>
                We're looking for a TanStack Config OSS Partner to go above and
                beyond the call of sponsorship. Are you as invested in TanStack
                Config as we are? Let's push the boundaries of Config together!
              </div>
              <a
                href="mailto:partners@tanstack.com?subject=TanStack Config Partnership"
                className="text-blue-500 uppercase font-black text-sm"
              >
                Let's chat
              </a>
            </div>
          </div>
        </div>

        <div className="relative text-lg overflow-hidden">
          <h3 className="text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-8">
            Sponsors
          </h3>
          <div
            className="my-4 flex flex-wrap mx-auto max-w-screen-lg"
            style={{
              aspectRatio: '1/1',
            }}
          >
            <Await
              promise={sponsorsPromise}
              fallback={<CgSpinner className="text-2xl animate-spin" />}
              children={(sponsors) => {
                return <SponsorPack sponsors={sponsors} />
              }}
            />
          </div>
          <div className="text-center">
            <a
              href="https://github.com/sponsors/tannerlinsley"
              className="inline-block bg-green-500 px-4 py-2 text-xl mx-auto leading-tight font-extrabold tracking-tight text-white rounded-full"
            >
              Become a Sponsor!
            </a>
          </div>
        </div>

        <div className="mx-auto max-w-[400px] flex flex-col gap-2 items-center">
          <div className="shadow-lg rounded-lg overflow-hidden bg-white dark:bg-gray-800 dark:text-white">
            <Carbon />
          </div>
          <span
            className="text-[.7rem] bg-gray-500 bg-opacity-10 py-1 px-2 rounded text-gray-500
                dark:bg-opacity-20"
          >
            This ad helps us keep the lights on 😉
          </span>
        </div>

        <div className="flex flex-col gap-4 items-center">
          <div className="font-extrabold text-xl lg:text-2xl">
            Wow, you've come a long way!
          </div>
          <div className="italic font-sm opacity-70">
            Only one thing left to do...
          </div>
          <div>
            <Link
              to="./docs/"
              className={`inline-block py-2 px-4 bg-gray-500 text-white rounded uppercase font-extrabold`}
            >
              Get Started!
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    </>
  )
}
