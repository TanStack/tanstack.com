import {
  ErrorComponent,
  ErrorComponentProps,
  Link,
  rootRouteId,
  useMatch,
  useRouter,
} from '@tanstack/react-router'
import { Button } from './Button'

// type DefaultCatchBoundaryType = {
//   status: number
//   statusText: string
//   data: string
//   isRoot?: boolean
// }

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter()
  const isRoot = useMatch({
    strict: false,
    select: (state) => state.id === rootRouteId,
  })

  console.error(error)

  return (
    <div className="min-w-0 flex-1 p-4 flex flex-col items-center justify-center gap-6">
      <h1 className="opacity-10 flex flex-col text-center font-black">
        {/* <div className="text-7xl leading-none">{status}</div>
        {statusText ? (
          <div className="text-3xl leading-none">{statusText}</div>
        ) : null} */}
      </h1>
      <ErrorComponent error={error} />
      <div className="flex gap-2 items-center flex-wrap">
        <Button
          onClick={() => {
            router.invalidate()
          }}
          className="bg-gray-600 border-gray-600 hover:bg-gray-700 text-white"
        >
          Try Again
        </Button>
        {isRoot ? (
          <Button
            as={Link}
            to="/"
            className="bg-gray-600 border-gray-600 hover:bg-gray-700 text-white"
          >
            TanStack Home
          </Button>
        ) : (
          <Button
            as={Link}
            to="/"
            className="bg-gray-600 border-gray-600 hover:bg-gray-700 text-white"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault()
              window.history.back()
            }}
          >
            Go Back
          </Button>
        )}
      </div>
    </div>
  )
}
