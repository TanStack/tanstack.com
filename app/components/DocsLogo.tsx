import { Link } from '@remix-run/react'

type Props = {
  name: string
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
      <Link to="../../" className={`font-bold`}>
        <span className={`${gradientText}`}>{name}</span>{' '}
        <span className="text-sm align-super">{version}</span>
      </Link>
    </>
  )
}
