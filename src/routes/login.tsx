import { redirect } from '@tanstack/react-router'
import { createServerFn, json } from '@tanstack/react-start'
import { setAuthOnResponse } from '~/auth/auth'
import { useMutation } from '~/hooks/useMutation'

const loginFn = createServerFn({ method: 'POST' })
  .validator(
    (
      d: TypedFormData<{
        username: string
        password: string
      }>,
    ) => d,
  )
  .handler(async ({ data }) => {
    const username = data.get('username') as string
    const password = data.get('password') as string

    if (username !== 'admin') {
      return { errors: { username: 'Invalid username. Try "admin"' } }
    }

    if (password !== 'password') {
      return { errors: { password: 'Invalid password. Try "password"' } }
    }

    throw await setAuthOnResponse(json(redirect({ to: '/dashboard' })), '1234')
  })

export const Route = createFileRoute({
  component: LoginComp,
})

function LoginComp() {
  const mutation = useMutation({
    fn: loginFn,
  })

  return (
    <div className="space-y-2 p-4">
      <h1 className="text-2xl font-bold">Login</h1>
      <form onSubmit={mutation.handleSubmit} className="space-y-2">
        <div className="space-y-2">
          <div>
            <label className="inline-flex flex-col gap-1">
              <span className="text-xs font-bold uppercase opacity-50">
                Username
              </span>
              <input
                type="text"
                name="username"
                placeholder="tanner"
                className="rounded px-2 py-1 shadow-lg"
              />
              {mutation.data?.errors?.username ? (
                <div className="text-xs text-red-500">
                  {mutation.data.errors.username}
                </div>
              ) : null}
            </label>
          </div>
          <div>
            <label className="inline-flex flex-col gap-1">
              <span className="text-xs font-bold uppercase opacity-50">
                Password
              </span>
              <input
                type="password"
                name="password"
                placeholder="********"
                className="rounded px-2 py-1 shadow-lg"
              />
              {mutation.data?.errors?.password ? (
                <div className="text-xs text-red-500">
                  {mutation.data.errors.password}
                </div>
              ) : null}
            </label>
          </div>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-blue-500 p-2 font-black text-white uppercase"
        >
          Submit
        </button>
      </form>
    </div>
  )
}

// function useAction<TPayload, TResponse>(
//   action: (formData: TypedFormData<TPayload>) => Promise<TResponse>
// ) {
//   return useMutation(action)
// }

interface TypedFormData<TData extends Record<string, any>> extends FormData {
  get: <TKey extends keyof TData>(name: TKey) => TData[TKey]
}
