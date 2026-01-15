/**
 * Hook for syncing builder state with URL search params
 * Enables shareable builder configurations via URL
 */

import * as React from 'react'
import { useSearch, useNavigate } from '@tanstack/react-router'
import {
  useProjectName,
  useRouterMode,
  useAddOns,
  useProjectStarter,
  useProjectOptions,
  useReady,
  setProjectName,
  setRouterMode,
  setTypeScript,
  setTailwind,
} from '@tanstack/cta-ui-base/dist/store/project'
import type { BuilderSearchParams } from '../types'

// Debounce helper to avoid excessive URL updates
function useDebouncedCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delay: number,
) {
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  return React.useCallback(
    (...args: TArgs) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    },
    [callback, delay],
  )
}

export function useBuilderSearch() {
  const navigate = useNavigate()
  const ready = useReady()

  // Get current search params - this will be typed by the route
  const search = useSearch({ from: '/builder' }) as BuilderSearchParams

  // CTA state hooks - only use useAddOns when ready to avoid iteration bug
  const projectName = useProjectName()
  const routerMode = useRouterMode()
  const addOnsResult = useAddOns()
  const chosenAddOns = ready ? addOnsResult.chosenAddOns : []
  const projectStarter = useProjectStarter((s) => s.projectStarter)
  const typescript = useProjectOptions((s) => s.typescript)
  const tailwind = useProjectOptions((s) => s.tailwind)

  // Track if we're currently syncing from URL to avoid loops
  const isSyncingFromUrl = React.useRef(false)
  const isInitialized = React.useRef(false)

  // Debounced URL update to avoid excessive history entries
  const updateUrl = useDebouncedCallback((params: BuilderSearchParams) => {
    if (isSyncingFromUrl.current) return

    navigate({
      to: '/builder',
      search: (prev: BuilderSearchParams) => ({
        ...prev,
        ...params,
      }),
      replace: true,
    })
  }, 300)

  // Initialize from URL params on mount
  React.useEffect(() => {
    if (isInitialized.current) return
    isInitialized.current = true

    isSyncingFromUrl.current = true

    // Set project name from URL or use a better default
    setProjectName(search.name || 'my-tanstack-app')

    if (search.mode) {
      setRouterMode(search.mode)
    }

    if (typeof search.ts === 'boolean') {
      setTypeScript(search.ts)
    }

    if (typeof search.tw === 'boolean') {
      setTailwind(search.tw)
    }

    // Starter and addons need registry to be loaded first
    // They'll be handled in a separate effect

    // Allow time for CTA to process before enabling URL sync
    setTimeout(() => {
      isSyncingFromUrl.current = false
    }, 500)
  }, [search])

  // Sync CTA state -> URL (after initialization)
  React.useEffect(() => {
    if (!isInitialized.current || isSyncingFromUrl.current) return

    updateUrl({
      name: projectName || undefined,
      mode: routerMode as BuilderSearchParams['mode'],
      ts: typescript,
      tw: tailwind,
      starter: projectStarter?.id,
      addons: chosenAddOns.length > 0 ? chosenAddOns.join(',') : undefined,
    })
  }, [
    projectName,
    routerMode,
    chosenAddOns,
    projectStarter,
    typescript,
    tailwind,
    updateUrl,
  ])

  // Return current params for consumers
  return {
    search,
    projectName,
    routerMode,
    chosenAddOns,
    projectStarter,
    typescript,
    tailwind,
  }
}

// Hook for initializing addons from URL after registry loads
export function useInitializeAddonsFromUrl() {
  const ready = useReady()
  const search = useSearch({ from: '/builder' }) as BuilderSearchParams
  const addOnsResult = useAddOns()
  const initialized = React.useRef(false)

  // Only access addOns properties when ready
  const availableAddOns = ready ? addOnsResult.availableAddOns : []
  const chosenAddOns = ready ? addOnsResult.chosenAddOns : []
  const toggleAddOn = addOnsResult.toggleAddOn

  React.useEffect(() => {
    if (!ready) return
    if (initialized.current) return
    if (!search.addons) return
    if (availableAddOns.length === 0) return

    initialized.current = true

    const urlAddons = search.addons.split(',').filter(Boolean)

    for (const addonId of urlAddons) {
      const addon = availableAddOns.find((a) => a.id === addonId)
      if (addon && !chosenAddOns.includes(addonId)) {
        toggleAddOn(addonId)
      }
    }
  }, [ready, search.addons, availableAddOns, toggleAddOn, chosenAddOns])
}
