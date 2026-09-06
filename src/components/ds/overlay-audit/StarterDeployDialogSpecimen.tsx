import { GitHub } from '~/ui'
import { twMerge } from 'tailwind-merge'
import type { SpecimenProps } from './types'

/**
 * AUDIT SPECIMEN — verbatim shell of
 * `src/components/application-starter/DeployDialog.tsx`.
 *
 * Kept alongside ExampleDeployDialogSpecimen deliberately. The two originals
 * are 480 and 585 lines and their shells are identical down to the class
 * order; they differ only in the header's provider branding and the payload
 * of the wizard steps. This is the clearest single case for extraction in the
 * whole audit.
 */
export function StarterDeployDialogSpecimen({
  open,
  onOpenChange,
}: SpecimenProps) {
  if (!open) return null

  const providerInfo = null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-label="Close dialog"
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div
              className={twMerge(
                'w-10 h-10 rounded-lg flex items-center justify-center',
                !providerInfo && 'bg-gray-800',
              )}
            >
              <GitHub className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Push to GitHub
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                my-tanstack-app
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <label
            htmlFor="specimen-repo"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Repository name
          </label>
          <input
            id="specimen-repo"
            defaultValue="my-tanstack-app"
            className="w-full px-3 py-2 pr-9 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2"
          />
          <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            The repository will be created under your personal account.
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-transparent bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-sm font-medium transition-colors"
            >
              Create repo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
