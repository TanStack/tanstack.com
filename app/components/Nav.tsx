import { Link } from 'remix'
import { tw } from 'twind'

const links = [
  { href: 'https://github.com/tannerlinsley', label: 'GitHub' },
  { href: 'https://discord.com/invite/WrRKjPJ', label: 'Discord' },
]

export function Nav() {
  return (
    <nav className={tw`max-w-screen-md mx-auto text-white`}>
      <ul className={tw`flex items-center justify-between p-8`}>
        <li>
          <Link to="/">
            <img
              src={require('../images/logo-white.svg')}
              alt="TanStack Logo"
              width={100}
              height={20}
            />
          </Link>
        </li>
        <ul className={tw`flex items-center justify-between space-x-2`}>
          {links.map(({ href, label }) => (
            <li key={`${href}${label}`}>
              <Link
                to={href}
                className={tw`inline px-2 py-1 rounded-md transition-all hover:(bg-gray-900 bg-opacity-20)`}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </ul>
    </nav>
  )
}
