import * as React from 'react'
import { useLocation } from '@tanstack/react-router'
import { useScript } from './useScript'

/**
 * Configuration for HubSpot chat widget
 */
export interface HubSpotChatConfig {
  /**
   * Array of path patterns where HubSpot should load.
   * Can be exact paths or path prefixes (e.g., '/paid-support' or '/workshops')
   * @default ['/paid-support', '/workshops']
   */
  enabledPaths?: string[]
  /**
   * HubSpot script source URL
   * @default '//js-na1.hs-scripts.com/45982155.js'
   */
  scriptSrc?: string
  /**
   * HubSpot script ID
   * @default 'hs-script-loader'
   */
  scriptId?: string
}

const defaultConfig = {
  enabledPaths: ['/paid-support', '/workshops'],
  scriptSrc: '//js-na1.hs-scripts.com/45982155.js',
  scriptId: 'hs-script-loader',
}

/**
 * Hook to conditionally load HubSpot chat widget based on current route
 * @param config Optional configuration object to override defaults
 */
export function useHubSpotChat(config?: HubSpotChatConfig) {
  const location = useLocation()
  const { enabledPaths, scriptSrc, scriptId } = {
    ...defaultConfig,
    ...config,
  }

  const shouldLoad = React.useMemo(() => {
    return enabledPaths.some((path) => {
      // Exact match
      if (location.pathname === path) {
        return true
      }
      // Prefix match (e.g., '/paid-support' matches '/paid-support/anything')
      if (location.pathname.startsWith(path + '/')) {
        return true
      }
      return false
    })
  }, [location.pathname, enabledPaths])

  // Only load the script if we should load the chat widget
  useScript(
    shouldLoad
      ? {
          id: scriptId,
          async: true,
          defer: true,
          src: scriptSrc,
        }
      : {
          id: scriptId,
          async: true,
          defer: true,
          src: '', // Empty src prevents loading
        },
  )
}
