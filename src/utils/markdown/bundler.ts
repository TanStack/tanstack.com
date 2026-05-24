/**
 * Shared types and constants for bundler tabs.
 * Used by both the rehype tabs transform and the BundlerTabs component.
 */

export type Bundler = 'vite' | 'rsubild'

export const BUNDLERS: Bundler[] = ['vite', 'rsubild']

export const DEFAULT_BUNDLER: Bundler = 'vite'

export const BUNDLER_LABELS: Record<Bundler, string> = {
  vite: 'Vite',
  rsubild: 'Rsbuild',
}

export function isBundler(value: string): value is Bundler {
  return (BUNDLERS as string[]).includes(value)
}
