/**
 * Framework metadata for the builder UI.
 * This file is safe to import on the client (no cta-engine dependencies).
 */

export type FrameworkId = 'react-cra' | 'solid'

export const FRAMEWORKS: Array<{
  id: FrameworkId
  name: string
  description: string
}> = [
  {
    id: 'react-cra',
    name: 'React',
    description: 'Full-stack React with TanStack Router',
  },
  {
    id: 'solid',
    name: 'Solid',
    description: 'Full-stack Solid with TanStack Router',
  },
]
