import { ErrorBoundaryComponent } from '@remix-run/node'

export const DefaultErrorBoundary: ErrorBoundaryComponent = ({ error }) => {
  console.error(error)

  return (
    <div className="w-full h-full flex flex-col gap-2 items-center justify-center p-4">
      <h1 className="text-lg font-bold">Something went wrong!</h1>
      <div>We'll get this fixed asap.</div>
    </div>
  )
}
