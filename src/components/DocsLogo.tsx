import { Link } from '@tanstack/react-router'
import { ThemeToggle } from './ThemeToggle'
import { BrandContextMenu } from '~/components/BrandContextMenu'

type Props = {
  name: string
  libraryId: string
  version: string
  colorFrom: string
  colorTo: string
}

export const DocsLogo = ({
  name,
  version,
  colorFrom,
  colorTo,
  libraryId,
}: Props) => {
  const gradientText = `inline-block text-transparent bg-clip-text bg-linear-to-r ${colorFrom} ${colorTo}`
  return (
    <>
      <BrandContextMenu className="inline-block">
        <Link to="/" className="font-light">
          TanStack
        </Link>
      </BrandContextMenu>
      <Link
        to={`/$libraryId`}
        className="font-bold whitespace-nowrap"
        params={{ libraryId }}
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
