import { Hydrate } from '@tanstack/react-start'
import { idle, visible } from '@tanstack/react-start/hydration'

import {
  ApplicationStarter,
  type ApplicationStarterProps,
} from '~/components/ApplicationStarter'

export function DeferredApplicationStarter(props: ApplicationStarterProps) {
  return (
    <Hydrate
      when={visible({ rootMargin: '320px 0px' })}
      prefetch={idle({ timeout: 2500 })}
      fallback={<DeferredApplicationStarterFallback mode={props.mode} />}
    >
      <ApplicationStarter {...props} />
    </Hydrate>
  )
}

function DeferredApplicationStarterFallback({
  mode = 'full',
}: {
  mode?: ApplicationStarterProps['mode']
}) {
  if (mode === 'compact') {
    return (
      <div aria-hidden="true" className="space-y-3">
        <div className="h-5 w-48 rounded bg-gray-200 dark:bg-gray-800" />
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
          <div className="border-b border-gray-200 px-3 py-2 dark:border-gray-800">
            <div className="h-3 w-10 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="mt-2 flex flex-wrap gap-2">
              <div className="h-8 w-24 rounded-md bg-gray-200 dark:bg-gray-800" />
              <div className="h-8 w-28 rounded-md bg-gray-200 dark:bg-gray-800" />
              <div className="h-8 w-20 rounded-md bg-gray-200 dark:bg-gray-800" />
            </div>
          </div>

          <div className="px-3 pb-2 pt-2">
            <div className="h-3 w-12 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="mt-2 h-20 rounded-md bg-gray-100 dark:bg-gray-900" />
          </div>

          <div className="border-t border-gray-200 px-3 py-2 dark:border-gray-800">
            <div className="h-8 w-24 rounded-md bg-gray-200 dark:bg-gray-800" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-[1rem] border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
    >
      <div className="border-b border-gray-200 bg-gray-50/70 px-5 py-4 dark:border-gray-800 dark:bg-gray-900/50">
        <div className="h-7 w-64 max-w-full rounded bg-gray-200 dark:bg-gray-800" />
        <div className="mt-4 flex flex-wrap gap-2">
          <div className="h-9 w-28 rounded-lg bg-gray-200 dark:bg-gray-800" />
          <div className="h-9 w-32 rounded-lg bg-gray-200 dark:bg-gray-800" />
          <div className="h-9 w-24 rounded-lg bg-gray-200 dark:bg-gray-800" />
        </div>
      </div>

      <div className="relative border-b border-gray-200 dark:border-gray-800">
        <div className="px-5 pt-4">
          <div className="h-3 w-12 rounded bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="px-5 pb-4 pt-3">
          <div className="h-28 rounded-xl bg-gray-100 dark:bg-gray-900" />
        </div>

        <div className="border-t border-gray-200 px-5 py-4 dark:border-gray-800">
          <div className="flex flex-wrap gap-3">
            <div className="h-10 w-28 rounded-lg bg-gray-200 dark:bg-gray-800" />
            <div className="h-10 w-36 rounded-lg bg-gray-200 dark:bg-gray-800" />
          </div>
        </div>
      </div>
    </div>
  )
}
