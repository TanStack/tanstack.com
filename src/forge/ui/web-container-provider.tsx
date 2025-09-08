import { createContext, useEffect, useState } from 'react'
import { useStore } from 'zustand'
import createWebContainerStore from '../webcontainer-store'

export const WebContainerContext = createContext<ReturnType<
  typeof createWebContainerStore
> | null>(null)

export default function WebContainerProvider({
  children,
  projectFiles,
}: {
  children: React.ReactNode
  projectFiles: Array<{ path: string; content: string }>
}) {
  const [containerStore] = useState(() => createWebContainerStore(true))

  const updateProjectFiles = useStore(
    containerStore,
    (state) => state.updateProjectFiles
  )

  useEffect(() => {
    updateProjectFiles(projectFiles)
  }, [updateProjectFiles, projectFiles])

  const teardown = useStore(containerStore, (state) => state.teardown)

  // useEffect(() => {
  //   return () => {
  //     teardown()
  //   }
  // }, [])

  return (
    <WebContainerContext.Provider value={containerStore}>
      {children}
    </WebContainerContext.Provider>
  )
}
