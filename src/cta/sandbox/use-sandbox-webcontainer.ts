'use client'

import { useContext, useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { WebContainerContext } from './web-container-provider'
import type { WebContainer } from '@webcontainer/api'

/**
 * Hook to access the WebContainer instance from the sandbox system
 * Returns the WebContainer promise
 */
export function useSandboxWebContainer() {
  const containerStore = useContext(WebContainerContext)

  if (!containerStore) {
    return null
  }

  const webContainerPromise = useStore(
    containerStore,
    (state) => state.webContainer
  )

  return webContainerPromise
}

/**
 * Hook to access the resolved WebContainer instance
 * Returns null if not yet resolved
 */
export function useSandboxWebContainerResolved() {
  const containerStore = useContext(WebContainerContext)
  const [resolvedContainer, setResolvedContainer] =
    useState<WebContainer | null>(null)

  if (!containerStore) {
    return null
  }

  const webContainerPromise = useStore(
    containerStore,
    (state) => state.webContainer
  )

  useEffect(() => {
    if (webContainerPromise) {
      webContainerPromise.then(setResolvedContainer)
    }
  }, [webContainerPromise])

  return resolvedContainer
}
