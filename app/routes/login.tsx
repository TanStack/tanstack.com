import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn, json } from '@tanstack/start'
import { setAuthOnResponse } from '~/auth/auth'
import { useMutation } from '~/hooks/useMutation'

const loginFn = createServerFn(
  'POST',
  async (
    formData: TypedFormData<{
      username: string
      password: string
    }>
  ) => {
    const username = formData.get('username') as string
    const password = formData.get('password') as string

    if (username !== 'admin') {
      return { errors: { username: 'Invalid username. Try "admin"' } }
    }

    if (password !== 'password') {
      return { errors: { password: 'Invalid password. Try "password"' } }
    }

    throw await setAuthOnResponse(json(redirect({ to: '/dashboard' })), '1234')
  }
)

export const Route = createFileRoute('/login')({
  component: LoginComp,
})

function LoginComp() {
  const mutation = useMutation({
    fn: loginFn,
  })

  return (
    <div className="p-4 space-y-2">
      <h1 className=" text-2xl font-bold">Login</h1>
      <form onSubmit={mutation.handleSubmit} className="space-y-2">
        <div className="space-y-2">
          <div>
            <label className="inline-flex flex-col gap-1 ">
              <span className="uppercase font-bold text-xs opacity-50">
                Username
              </span>
              <input
                type="text"
                name="username"
                placeholder="tanner"
                className="rounded py-1 px-2 shadow-lg"
              />
              {mutation.data?.errors?.username ? (
                <div className="text-red-500 text-xs">
                  {mutation.data.errors.username}
                </div>
              ) : null}
            </label>
          </div>
          <div>
            <label className="inline-flex flex-col gap-1 ">
              <span className="uppercase font-bold text-xs opacity-50">
                Password
              </span>
              <input
                type="password"
                name="password"
                placeholder="********"
                className="rounded py-1 px-2 shadow-lg"
              />
              {mutation.data?.errors?.password ? (
                <div className="text-red-500 text-xs">
                  {mutation.data.errors.password}
                </div>
              ) : null}
            </label>
          </div>
        </div>
        <button
          type="submit"
          className="bg-blue-500 rounded-lg p-2 text-white font-black uppercase"
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
