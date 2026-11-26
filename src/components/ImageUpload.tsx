import * as React from 'react'
import { createClientOnlyFn } from '@tanstack/react-start'
import { ClientOnly } from '@tanstack/react-router'
import type { ImageUploadProps } from './ImageUpload.client'

const LazyImageUploadClient = React.lazy(
  createClientOnlyFn(() =>
    import('./ImageUpload.client').then((m) => ({
      default: m.ImageUploadClient,
    })),
  ),
)

export type { ImageUploadProps }

export function ImageUpload(props: ImageUploadProps) {
  return (
    <ClientOnly>
      <React.Suspense fallback={null}>
        <LazyImageUploadClient {...props} />
      </React.Suspense>
    </ClientOnly>
  )
}
