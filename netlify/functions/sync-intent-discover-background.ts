import type { Config } from '@netlify/functions'
import {
  discoverIntentPackagesFromNpm,
  discoverIntentPackagesViaGitHub,
} from '~/utils/intent-discovery.server'

/**
 * Netlify Scheduled Function - Discover Intent-compatible npm packages
 *
 * Phase 1 of 2. Fast: no tarball downloads (except brief header peeks for GitHub path).
 *
 * Two discovery paths:
 *   1. NPM keyword search — instant, finds packages that published with tanstack-intent keyword
 *   2. GitHub code search — finds repos that depend on @tanstack/intent but may not have the keyword yet
 *
 * Both paths enqueue new versions for tarball processing (syncStatus = 'pending').
 * Actual skill extraction happens in sync-intent-process-background.
 *
 * Scheduled: Every 6 hours
 */
const handler = async (req: Request) => {
  const { next_run } = await req.json()
  const startTime = Date.now()

  console.log('[intent-discover] Starting discovery (NPM + GitHub)...')

  let versionsEnqueued = 0
  const errors: Array<string> = []

  try {
    console.log(
      '[intent-discover] Searching NPM for keywords:tanstack-intent...',
    )
    const npmResult = await discoverIntentPackagesFromNpm()
    versionsEnqueued += npmResult.versionsEnqueued
    errors.push(...npmResult.errors.map((error) => `npm/${error}`))

    console.log(
      `[intent-discover] NPM found ${npmResult.packagesDiscovered} candidates and verified ${npmResult.packagesVerified}`,
    )
  } catch (error) {
    console.error(
      '[intent-discover] NPM path failed:',
      error instanceof Error ? error.message : String(error),
    )
  }

  if (process.env.GITHUB_AUTH_TOKEN) {
    try {
      console.log(
        '[intent-discover] Searching GitHub for @tanstack/intent dependents...',
      )
      const githubResult = await discoverIntentPackagesViaGitHub()
      versionsEnqueued += githubResult.enqueued
      errors.push(...githubResult.errors.map((error) => `github/${error}`))

      console.log(
        `[intent-discover] GitHub searched ${githubResult.searched} candidates, checked ${githubResult.checkedOnNpm} packages, found ${githubResult.hadSkills} with skills`,
      )
    } catch (error) {
      console.error(
        '[intent-discover] GitHub path failed:',
        error instanceof Error ? error.message : String(error),
      )
    }
  } else {
    console.warn(
      '[intent-discover] GITHUB_AUTH_TOKEN not set, skipping GitHub path',
    )
  }

  const duration = Date.now() - startTime
  console.log(
    `[intent-discover] Done in ${duration}ms - enqueued: ${versionsEnqueued}, errors: ${errors.length}`,
  )
  if (errors.length > 0)
    console.warn(`[intent-discover] Errors:\n  ${errors.join('\n  ')}`)
  console.log('[intent-discover] Next invocation at:', next_run)
}

export default handler

export const config: Config = {
  schedule: '0 */6 * * *', // Every 6 hours
}
