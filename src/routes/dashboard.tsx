import { createServerFn } from '@tanstack/react-start'
import { getWebRequest } from '@tanstack/react-start/server'
import { redirectWithClearedCookie, requireAuthCookie } from '~/auth/auth'
import { useMutation } from '~/hooks/useMutation'

const loadDashboard = createServerFn({ method: 'GET' }).handler(async () => {
  const userId = await requireAuthCookie(getWebRequest())

  return {
    userId,
  }
})

const logoutFn = createServerFn({ method: 'POST' }).handler(async () => {
  return redirectWithClearedCookie()
})

export const Route = createFileRoute({
  loader: () => loadDashboard(),
  component: LoginComp,
})

function LoginComp() {
  const { userId } = Route.useLoaderData()

  const mutation = useMutation({
    fn: logoutFn,
  })

  return (
    <div className="space-y-2 p-4">
      <h1 className="text-2xl font-black">Dashboard</h1>
      <div>
        Welcome! Your userId is "{userId}" This is an experiment to test:
      </div>
      <ul className="list-disc pl-4 text-sm">
        <li>
          Our ability to access original document request headers and cookies in
          server functions
        </li>
        <li>Our ability to clear cookies in server functions</li>
        <li>Our ability to redirect from server functions</li>
        <li>Our ability to use a custom hook to manage mutations</li>
      </ul>
      <div>
        <button
          onClick={() => mutation.mutate(undefined as never)}
          className="rounded bg-red-500 px-4 py-2 text-white"
        >
          Logout
        </button>
      </div>
    </div>
  )
}
