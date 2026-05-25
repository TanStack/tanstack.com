import { createFileRoute } from '@tanstack/react-router'

import { HomeEditorial } from '~/components/home/HomeEditorial'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/')({
  // Skip the global left-rail Navbar on the editorial homepage; the
  // EditorialTopNav (rendered in __root.tsx) handles navigation.
  staticData: {
    showNavbar: false,
  },
  head: () => ({
    meta: seo({
      title: 'TanStack | The open-source application stack for the web.',
      description:
        'Headless, type-safe, composable tools for building modern web applications that work naturally for developers and reliably for agents.',
    }),
  }),
  component: HomeEditorial,
})
