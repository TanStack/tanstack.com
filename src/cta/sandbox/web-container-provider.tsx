import { createContext, useEffect, useState, useRef } from 'react'
import { useStore } from 'zustand'
import createWebContainerStore from './use-webcontainer-store'

export const WebContainerContext = createContext<ReturnType<
  typeof createWebContainerStore
> | null>(null)

export default function WebContainerProvider({
  children,
  projectFiles,
  shouldShimALS = true,
}: {
  children: React.ReactNode
  projectFiles: Array<{ path: string; content: string }>
  shouldShimALS?: boolean
}) {
  console.log(
    'WebContainerProvider rendering with',
    projectFiles.length,
    'files'
  )
  const [containerStore] = useState(() =>
    createWebContainerStore(shouldShimALS)
  )

  const updateProjectFiles = useStore(
    containerStore,
    (state) => state.updateProjectFiles
  )

  const lastFilesHashRef = useRef<string>('')

  useEffect(() => {
    // Ignore empty file updates after initial load (prevents state reset)
    if (projectFiles.length === 0 && lastFilesHashRef.current !== '') {
      console.log(
        'WebContainerProvider: Ignoring 0-file update (likely transient state)'
      )
      return
    }

    // Create a hash of the files to prevent duplicate updates
    const filesHash = projectFiles
      .map((f) => `${f.path}:${f.content.length}`)
      .join('|')

    if (filesHash === lastFilesHashRef.current) {
      console.log('WebContainerProvider: Files unchanged, skipping update')
      return
    }

    lastFilesHashRef.current = filesHash
    console.log(
      'WebContainerProvider useEffect triggered with',
      projectFiles.length,
      'files'
    )
    updateProjectFiles(projectFiles)
  }, [updateProjectFiles, projectFiles])

  return (
    <WebContainerContext.Provider value={containerStore}>
      {children}
    </WebContainerContext.Provider>
  )
}
