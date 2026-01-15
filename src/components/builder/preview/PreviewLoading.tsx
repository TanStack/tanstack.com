/**
 * PreviewLoading - Loading and error states for WebContainer preview
 */

import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import { SETUP_STEP_LABELS, type SetupStep } from '../types'

type PreviewLoadingProps = {
  setupStep: SetupStep | string
  error: string | null
}

export function PreviewLoading({ setupStep, error }: PreviewLoadingProps) {
  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4 max-w-md text-center p-6">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Preview Error
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            WebContainer requires specific browser headers. Make sure COOP/COEP
            headers are configured.
          </p>
        </div>
      </div>
    )
  }

  const stepLabel = SETUP_STEP_LABELS[setupStep as SetupStep] ?? setupStep

  return (
    <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col items-center gap-6">
        {/* Spinner */}
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-gray-200 dark:border-gray-700" />
          <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-t-blue-500 animate-spin" />
        </div>

        {/* Status */}
        <div className="text-center">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            {stepLabel}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Setting up your development environment
          </p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-2">
          <ProgressStep
            label="Boot"
            isActive={setupStep === 'booting'}
            isComplete={isStepComplete('booting', setupStep as SetupStep)}
          />
          <ProgressConnector
            isComplete={isStepComplete('booting', setupStep as SetupStep)}
          />
          <ProgressStep
            label="Install"
            isActive={setupStep === 'installing'}
            isComplete={isStepComplete('installing', setupStep as SetupStep)}
          />
          <ProgressConnector
            isComplete={isStepComplete('installing', setupStep as SetupStep)}
          />
          <ProgressStep
            label="Start"
            isActive={setupStep === 'starting'}
            isComplete={isStepComplete('starting', setupStep as SetupStep)}
          />
        </div>
      </div>
    </div>
  )
}

function isStepComplete(step: SetupStep, currentStep: SetupStep): boolean {
  const order: SetupStep[] = [
    'idle',
    'booting',
    'installing',
    'starting',
    'ready',
  ]
  const stepIndex = order.indexOf(step)
  const currentIndex = order.indexOf(currentStep)
  return currentIndex > stepIndex
}

type ProgressStepProps = {
  label: string
  isActive: boolean
  isComplete: boolean
}

function ProgressStep({ label, isActive, isComplete }: ProgressStepProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={twMerge(
          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors',
          isComplete
            ? 'bg-green-500 text-white'
            : isActive
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
        )}
      >
        {isComplete ? (
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        ) : (
          <span>{label[0]}</span>
        )}
      </div>
      <span className="text-[10px] text-gray-500 dark:text-gray-400">
        {label}
      </span>
    </div>
  )
}

function ProgressConnector({ isComplete }: { isComplete: boolean }) {
  return (
    <div
      className={twMerge(
        'w-8 h-0.5 -mt-4',
        isComplete ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700',
      )}
    />
  )
}
