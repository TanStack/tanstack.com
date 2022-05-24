import { LoaderFunction, Outlet, redirect } from 'remix'

export const loader: LoaderFunction = async (context) => {
  if (!context.request.url.includes('/react-table/v')) {
    return redirect(`${new URL(context.request.url).origin}/react-table/v8`)
  }

  return new Response('OK')
}

export default function RouteReactTable() {
  return <Outlet />
}
