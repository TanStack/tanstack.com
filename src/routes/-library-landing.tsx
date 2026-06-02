import type { ReactNode } from 'react'
import { notFound } from '@tanstack/react-router'
import { findLibrary, getBranch, getLibrary } from '~/libraries'
import type { LibraryId } from '~/libraries'
import { getTanstackDocsConfig } from '~/utils/config'

export type LandingComponentProps = {
  landingCodeExampleRsc?: ReactNode
}

function getLibraryOrThrow(libraryId: string) {
  const library = findLibrary(libraryId)

  if (!library) {
    throw notFound()
  }

  return library
}

export function validateLibraryVersion(
  libraryId: string,
  version: string | undefined,
  onInvalidVersion: () => never,
) {
  const library = getLibraryOrThrow(libraryId)

  if (!library.availableVersions.concat('latest').includes(version!)) {
    onInvalidVersion()
  }

  return library
}

export async function loadLibraryConfig(libraryId: LibraryId, version: string) {
  const library = getLibrary(libraryId)
  const branch = getBranch(library, version)

  return getTanstackDocsConfig({
    data: {
      repo: library.repo,
      branch,
      docsRoot: library.docsRoot || 'docs',
    },
  })
}
