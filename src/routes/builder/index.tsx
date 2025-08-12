import "./styles.css"

import { seo } from '~/utils/seo'
import App from "@tanstack/cta-ui-base/src"

export const Route = createFileRoute({
  component: BuilderComponent,
  head: () => ({
    meta: seo({
      title: 'TanStack Builder',
      description: 'Build amazing applications with TanStack',
    }),
  }),
})

function BuilderComponent() {
  return (
    <>
    <App />
    </>
  )
}