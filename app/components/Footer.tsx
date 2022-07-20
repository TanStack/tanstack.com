import { Link } from '@remix-run/react'

const footerLinks = [
  { label: 'Blog', to: '/blog' },
  { label: '@Tan_Stack Twitter', to: 'https://twitter.com/tan_stack' },
  {
    label: '@TannerLinsley Twitter',
    to: 'https://twitter.com/tannerlinsley',
  },
  { label: 'Github', to: 'https://github.com/tanstack' },
  {
    label: 'Youtube',
    to: 'https://www.youtube.com/user/tannerlinsley',
  },
  {
    label: 'Nozzle.io - Keyword Rank Tracker',
    to: 'https://nozzle.io',
  },
]

export function Footer() {
  return (
    <div
      className={`flex flex-col items-start justify-center gap-4 p-8
      max-w-screen-lg mx-auto text-sm
      bg-white dark:bg-gray-800 shadow-xl shadow-black/10 rounded-t-lg`}
    >
      <div className={`grid gap-1 sm:grid-cols-2 md:grid-cols-3`}>
        {footerLinks.map((item) => (
          <div key={item.to}>
            {item.to.startsWith('http') ? (
              <a href={item.to}>{item.label}</a>
            ) : (
              <Link to={item.to}>{item.label}</Link>
            )}
          </div>
        ))}
      </div>
      <div className={`text-center opacity-20`}>
        &copy; {new Date().getFullYear()} Tanner Linsley
      </div>
    </div>
  )
}
