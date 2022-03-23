import { tw } from 'twind/css';
import {
  ActionFunction,
  Form,
  MetaFunction,
  useActionData,
  useTransition,
} from 'remix';
import { Nav } from '~/components/Nav';
import { Carbon } from '~/components/Carbon';
import { ParentSize } from '@visx/responsive';

const libraries = [
  {
    name: 'React Query',
    getStyles: () =>
      tw`bg-red-500 hover:(bg-white border-red-500 bg-transparent text-red-500 dark:text-red-400)`,
    href: 'https://react-query.tanstack.com',
    tagline: `Performant and powerful data synchronization for React`,
    description: `Fetch, cache and update data in your React and React Native applications all without touching any "global state".`,
  },
  {
    name: 'React Table',
    getStyles: () =>
      tw`bg-blue-500 hover:(bg-white border-blue-500 bg-transparent text-blue-600 dark:text-blue-400)`,
    href: 'https://react-table.tanstack.com',
    tagline: `Lightweight and extensible data tables for React`,
    description: `Build and design powerful datagrid experiences while retaining 100% control over markup and styles.`,
  },
  {
    name: 'React Charts',
    getStyles: () =>
      tw`bg-yellow-500 text-black hover:(bg-white border-yellow-500 bg-transparent dark:text-yellow-500)`,
    href: 'https://react-charts.tanstack.com',
    tagline: `Simple, immersive & interactive charts for React`,
    description: `Flexible, declarative, and highly configurable charts designed to pragmatically display dynamic data.`,
  },
  {
    name: 'React Location',
    getStyles: () =>
      tw`bg-green-500 hover:(bg-white border-green-700 bg-transparent text-green-700 dark:text-green-400)`,
    href: 'https://react-location.tanstack.com',
    tagline: `Enterprise routing for React applications`,
    description: `Powerful, enterprise-grade routing including first-class URL Search APIs, declarative/suspendable route loaders & code-splitting and more.`,
  },
  {
    name: 'React Virtual',
    getStyles: () =>
      tw`bg-purple-600 hover:(bg-white border-purple-700 bg-transparent text-purple-700 dark:text-purple-400)`,
    href: 'https://react-virtual.tanstack.com',
    tagline: `Auto-sizing, buttery smooth headless virtualization... with just one hook.`,
    description: `Oh, did we mention it supports vertical, horizontal, grid, fixed, variable, dynamic, smooth and infinite virtualization too?`,
  },
];

const courses = [
  {
    name: 'The Official React Query Course',
    getStyles: () => tw`border-t-4 border-red-500 hover:(border-green-500)`,
    href: 'https://ui.dev/checkout/react-query?from=tanstack',
    description: `Learn how to build enterprise quality apps with React Query the easy way with our brand new course.`,
    price: `$149`,
  },
];

const footerLinks = [
  { name: 'Twitter', href: 'https://twitter.com/tannerlinsley' },
  {
    name: 'Youtube',
    href: 'https://www.youtube.com/user/tannerlinsley',
  },
  { name: 'Github', href: 'https://github.com/tannerlinsley' },
  {
    name: 'Nozzle.io - Keyword Rank Tracker',
    href: 'https://nozzle.io',
  },
  {
    name: `Tanner's Blog`,
    href: 'https://tannerlinsley.com',
  },
];

export let meta: MetaFunction = () => {
  const title = 'Quality Software & Open Source Libraries for the Modern Web';
  const description = `TanStack is an incubator and collection of software, products, tools and courses for building professional and enterprise-grade front-end applications for the web.`;
  const imageHref = 'https://tanstack.com/favicon.png';
  return {
    title,
    description,
    keywords:
      'tanstack,react,reactjs,react query,react table,open source,open source software,oss,software',
    'twitter:image': imageHref,
    'twitter:card': 'summary_large_image',
    'twitter:creator': '@tannerlinsley',
    'twitter:site': '@tannerlinsley',
    'twitter:title': 'TanStack',
    'twitter:description': description,
    'og:type': 'website',
    'og:title': title,
    'og:description': description,
    'og:image': imageHref,
  };
};

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  return fetch(`https://bytes.dev/api/bytes-optin-cors`, {
    method: 'POST',
    body: JSON.stringify({
      email: formData.get('email_address'),
      influencer: 'tanstack',
    }),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });
};

export default function Index() {
  const data = useActionData();
  const transition = useTransition();
  const isLoading = transition.state === 'submitting';
  const hasSubmitted = data?.status === 'success';
  const hasError = data?.status === 'error';

  return (
    <div>
      <section
        className={tw`text-white relative bg-red-500`}
        style={{
          backgroundImage: `
          radial-gradient(circle at 25% 140vw, transparent 85%, ${tw.theme(
            'colors.yellow.500'
          )}),
          radial-gradient(circle at 75% -100vw, transparent 85%, ${tw.theme(
            'colors.blue.500'
          )})
          `,
        }}
      >
        <div
          className={tw`absolute bg-cover bg-center inset-0`}
          style={{
            backgroundImage: `url(${require('../images/header-left-overlay.svg')})`,
          }}
        />
        <div className={tw`relative`}>
          <Nav />
          <div className={tw`text-center -mt-20 p-20`}>
            <div className={tw`w-max mx-auto grid gap-2 grid-cols-2`}>
              <img
                src={require('../images/javascript-logo-white.svg')}
                alt="Javascript Logo"
                width={70}
                height={70}
              />
              <img
                src={require('../images/react-logo-white.svg')}
                alt="React Logo"
                width={70}
                height={70}
              />
            </div>
            <p className={tw`text-4xl text-center italic font-semibold mt-6`}>
              Quality Software & Libraries
            </p>
            <p className={tw`text-2xl text-center font-extralight`}>
              for the Modern Web
            </p>
          </div>
        </div>
      </section>
      <div
        className={tw`relative max-w-screen-md mx-2 rounded-md p-8 -mt-10 bg-white shadow-lg md:(p-14 mx-auto) dark:(bg-gray-800)`}
      >
        {!hasSubmitted ? (
          <Form method="post">
            <div>
              <div className={tw`relative inline-block`}>
                <h3 className={tw`text-3xl`}>Subscribe to Bytes</h3>
                <figure className={tw`absolute top-0 right-[-48px]`}>
                  <img
                    src={require('../images/bytes.svg')}
                    alt="Bytes Logo"
                    width={40}
                    height={40}
                  />
                </figure>
              </div>

              <h3 className={tw`text-lg mt-1`}>
                The Best Javascript Newletter
              </h3>
            </div>
            <div className={tw`grid grid-cols-3 mt-4 gap-2`}>
              <input
                disabled={transition.state === 'submitting'}
                className={tw`col-span-2 p-3 placeholder-gray-400 text-black bg-gray-200 rounded text-sm outline-none focus:outline-none w-full dark:(text-white bg-gray-700)`}
                name="email_address"
                placeholder="Your email address"
                type="text"
                required
              />
              <button
                type="submit"
                className={tw`bg-[#ED203D] text-white rounded`}
              >
                <span>{isLoading ? 'Loading ...' : 'Subscribe'}</span>
              </button>
            </div>
            {hasError ? (
              <p className={tw`text-sm text-red-500 font-semibold italic mt-2`}>
                Looks like something went wrong. Please try again.
              </p>
            ) : (
              <p className={tw`text-sm opacity-30 font-semibold italic mt-2`}>
                Join over 76,000 devs
              </p>
            )}
          </Form>
        ) : (
          <p>🎉 Thank you! Please confirm your email</p>
        )}
      </div>
      {/* <div className={tw`relative max-w-screen-md mx-2 rounded-md p-8 -mt-10 bg-white shadow-lg md:(p-14 mx-auto) dark:(bg-gray-800)`}>
        <h1 className={tw`text-2xl font-bold`}>Blog</h1>
        <div>
          {[1, 2, 3].map((d) => (
            <div key={d} className={tw`mt-10 text-lg`}>
              <div className={tw`font-bold`}>Hello</div>
              <div className={tw`italic mt-2`}>Preview</div>
              <div className={tw`mt-2 text-blue-500 dark:(text-red-500)`}>
                <Link href="/">Read →</Link>
              </div>
            </div>
          ))}
        </div>
      </div> */}
      <div className={tw`mt-12 max-w-screen-md mx-4 md:(mx-auto)`}>
        <div className={tw`grid grid-cols-1 gap-4 sm:(grid-cols-2)`}>
          <div>
            <h3 className={tw`text-4xl font-light`}>Products</h3>
            <div
              className={tw`mt-4 bg-white shadow-lg rounded-lg p-4 opacity-70 italic text-center text-gray-600 md:(p-10) dark:(bg-gray-800)`}
            >
              Coming soon!
            </div>
          </div>
          <div>
            <h3 className={tw`text-4xl font-light`}>Partners</h3>
            <div className={tw`mt-4`}>
              <Carbon />
            </div>
          </div>
        </div>
      </div>
      <div className={tw`mt-12 max-w-screen-md mx-4 md:(mx-auto)`}>
        <h3 className={tw`text-4xl font-light`}>Open Source Libraries</h3>
        <div className={tw`mt-4 grid grid-cols-1 gap-4 sm:(grid-cols-2)`}>
          {libraries.map((library) => (
            <a
              key={library.name}
              href={library.href}
              className={tw(
                `border-4 border-transparent rounded-lg shadow-lg p-4 md:(p-10) text-white transition-all`,
                library.getStyles()
              )}
              target="_blank"
            >
              <div className={tw`text-3xl font-bold `}>{library.name}</div>
              <div className={tw`text-lg italic font-extralight mt-2`}>
                {library.tagline}
              </div>
              <div className={tw`text-sm mt-2`}>{library.description}</div>
            </a>
          ))}
        </div>
      </div>
      <div
        className={tw`mt-12 max-w-screen-md mx-4
            md:(mx-auto)`}
      >
        <h3 className={tw`text-4xl font-light`}>Courses</h3>
        <div className={tw`mt-4 grid grid-cols-1 gap-4`}>
          {courses.map((course) => (
            <a
              key={course.name}
              href={course.href}
              className={tw(
                `bg-white rounded-lg shadow-lg p-4 grid grid-cols-3 gap-6 transition-all ease-linear
                    md:(p-8 grid-cols-6)
                    dark:(bg-gray-800)`,
                course.getStyles()
              )}
              target="_blank"
            >
              <div
                className={tw`col-span-2
                    md:(col-span-5)`}
              >
                <div className={tw`text-2xl font-bold `}>{course.name}</div>
                <div className={tw`text-sm mt-2`}>{course.description}</div>
                <div
                  className={tw`inline-block mt-4 px-4 py-2 bg-green-500 text-white rounded shadow`}
                >
                  Enroll →
                </div>
              </div>
              <div
                className={tw`flex-col text-center
                      md:(text-right)`}
              >
                <div className={tw`text-center text-3xl font-bold`}>
                  {course.price}
                </div>
                <div className={tw`text-center text-sm opacity-70`}>
                  per license
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
      <div
        className={tw`mt-12 max-w-screen-md mx-4
            md:(mx-auto)`}
      >
        <h3 className={tw`text-4xl font-light`}>OSS Sponsors</h3>
        <div className={tw`mt-4 overflow-hidden`}>
          <ParentSize>
            {({ width }) => {
              return (
                <iframe
                  src={
                    process.env.NODE_ENV === 'production'
                      ? 'https://tanstack.com/sponsors-embed'
                      : 'http://localhost:3001/sponsors-embed'
                  }
                  loading="lazy"
                  style={{
                    width: width,
                    height: width,
                    overflow: 'hidden',
                  }}
                />
              );
            }}
          </ParentSize>
        </div>
        <div className={tw`h-6`} />
        <div className={tw`text-center`}>
          <div>
            <a
              href="https://github.com/sponsors/tannerlinsley"
              className={tw`inline-block p-4 text-lg bg-green-500 rounded text-white`}
            >
              Become a Sponsor!
            </a>
          </div>
          <div className={tw`h-4`} />
          <p className={tw`italic mx-auto max-w-screen-sm text-gray-500`}>
            Sponsors get special perks like{' '}
            <strong>
              private discord channels, priority issue requests, direct support
              and even course vouchers
            </strong>
            !
          </p>
        </div>
      </div>
      <div
        className={tw`
          mt-12 mx-4 max-w-screen-md rounded-md p-4 shadow-lg grid gap-6
          bg-discord text-white overflow-hidden relative
          sm:(p-8 mx-auto grid-cols-3)`}
      >
        <div
          className={tw`absolute transform opacity-10 z-0
            right-0 top-0 -translate-y-1/3 translate-x-1/3
            sm:(opacity-20)`}
        >
          <img
            src={require('../images/discord-logo-white.svg')}
            width={300}
            height={300}
          />
        </div>
        <div className={tw`sm:(col-span-2)`}>
          <h3 className={tw`text-3xl`}>TanStack on Discord</h3>
          <p className={tw`mt-4`}>
            The official TanStack community to ask questions, network and make
            new friends and get lightning fast news about what's coming next for
            TanStack!
          </p>
        </div>
        <div className={tw`flex items-center justify-center`}>
          <a
            href="https://discord.com/invite/WrRKjPJ"
            target="_blank"
            rel="noreferrer"
            className={tw`block w-full mt-4 px-4 py-2 bg-white text-discord text-center text-lg rounded shadow-lg z-10`}
          >
            Join TanStack Discord
          </a>
        </div>
      </div>
      <div className={tw`h-20`} />
      <div className={tw`bg-gray-800 text-white shadow-lg`}>
        <div className={tw`max-w-screen-md mx-auto py-12 px-4`}>
          <div className={tw`grid gap-1 md:(grid-cols-2)`}>
            {footerLinks.map((link) => (
              <div key={link.href}>
                <a href={link.href} className={tw`hover:underline`}>
                  {link.name}
                </a>
              </div>
            ))}
          </div>
        </div>
        <div className={tw`text-center opacity-20 text-sm`}>
          &copy; {new Date().getFullYear()} Tanner Linsley
        </div>
        <div className={tw`h-8`}></div>
      </div>
    </div>
  );
}
