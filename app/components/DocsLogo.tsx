import { Link } from '@tanstack/react-router'
import { ThemeToggle } from './ThemeToggle'

type Props = {
  name: string
  linkTo: string
  version: string
  colorFrom: string
  colorTo: string
}

export const DocsLogo = (props: Props) => {
  const { name, version, colorFrom, colorTo } = props

  const gradientText = `inline-block text-transparent bg-clip-text bg-gradient-to-r ${colorFrom} ${colorTo}`

  return (
    <>
      <Link to="/" className="font-light">
        TanStack
      </Link>
      <Link
        to={`/${props.linkTo}`}
        className="font-bold whitespace-nowrap"
        params
      >
        <span className={`${gradientText}`}>{name}</span>{' '}
        <span className="text-sm align-super">{version}</span>
      </Link>
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </>
  )
}
