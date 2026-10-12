import { useRouter } from '@tanstack/react-router'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { C15tTanStackDevtoolsPanel } from '@c15t/react/devtools'

export function AppDevtools() {
  const router = useRouter()

  return (
    <TanStackDevtools
      config={{
        customTrigger: <span className="hidden" aria-hidden="true" />,
      }}
      plugins={[
        {
          name: 'TanStack Query',
          render: <ReactQueryDevtoolsPanel />,
        },
        {
          name: 'TanStack Router',
          render: <TanStackRouterDevtoolsPanel router={router} />,
        },
        // c15t's consent panel, reading the kernel from <ConsentRoot>. Written
        // out rather than c15tDevtools(): its fixed `id: 'c15t'` leaves the
        // panel empty in @tanstack/react-devtools 0.10.
        {
          name: 'c15t',
          render: (_element, { theme }) => (
            <C15tTanStackDevtoolsPanel theme={theme} />
          ),
        },
      ]}
    />
  )
}
