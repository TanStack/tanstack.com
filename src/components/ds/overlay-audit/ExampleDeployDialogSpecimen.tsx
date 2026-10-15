import * as React from 'react'
import {
  CheckCircleIcon,
  CircleNotchIcon,
  RocketIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import type { SpecimenProps } from './types'

type Step = 'auth-check' | 'needs-auth' | 'form' | 'success' | 'error'

const STEPS: Array<Step> = [
  'auth-check',
  'needs-auth',
  'form',
  'success',
  'error',
]

/**
 * AUDIT SPECIMEN — verbatim shell of `src/components/ExampleDeployDialog.tsx`.
 *
 * Note the shell is byte-identical to StarterDeployDialogSpecimen: same
 * `fixed inset-0 z-50`, same button-as-backdrop, same
 * `max-w-md ... rounded-xl shadow-2xl border` panel. Neither uses Radix, so
 * neither traps focus, restores focus on close, or closes on Escape.
 *
 * The step switcher is an audit affordance, not part of the original — it
 * exposes all five wizard states that the real dialog reaches over time.
 */
export function ExampleDeployDialogSpecimen({
  open,
  onOpenChange,
}: SpecimenProps) {
  const [step, setStep] = React.useState<Step>('form')

  if (!open) return null

  const providerColor = '#F38020'

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
        <div
          className="px-6 py-4 border-b border-gray-200 dark:border-gray-700"
          style={{ backgroundColor: `${providerColor}10` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: providerColor }}
            >
              <RocketIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Deploy to Cloudflare
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                start-basic
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'auth-check' && (
            <div className="flex flex-col items-center justify-center py-8">
              <CircleNotchIcon className="w-8 h-8 animate-spin text-gray-400" />
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                Checking authentication...
              </p>
            </div>
          )}

          {step === 'needs-auth' && (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                <RocketIcon className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Connect your account to continue deploying.
              </p>
            </div>
          )}

          {step === 'form' && (
            <div className="space-y-4">
              <label
                htmlFor="specimen-project"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Project name
              </label>
              <input
                id="specimen-project"
                defaultValue="tanstack-start-basic"
                className="w-full px-3 py-2 pr-9 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2"
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                A new repository will be created on your account and deployed.
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-transparent bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-sm font-medium transition-colors"
                >
                  Deploy
                </button>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                <CheckCircleIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Deployment started. This can take a couple of minutes.
              </p>
            </div>
          )}

          {step === 'error' && (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                <WarningCircleIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Deployment failed. Check your account permissions and retry.
              </p>
            </div>
          )}
        </div>

        {/* Audit-only step switcher */}
        <div className="flex flex-wrap gap-1 border-t border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-2">
          <span className="mr-1 self-center text-[10px] font-medium uppercase tracking-wide text-gray-400">
            Audit
          </span>
          {STEPS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStep(s)}
              className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                step === s
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
