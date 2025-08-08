import { redirect } from '@tanstack/react-router'
import { getLibrary } from '~/libraries'

export const Route = createFileRoute({
  beforeLoad: (ctx) => {
    const { libraryId } = ctx.params
    const library = getLibrary(libraryId)

    throw redirect({
      from: '/$libraryId/$version/docs',
      to: './$',
      params: {
        _splat: 'defaultDocs' in library ? library.defaultDocs : 'overview',
      },
    })
  },
})
