/**
 * ProjectConfig - Project name, router mode, and feature toggles
 */

import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import {
  useProjectName,
  useRouterMode,
  useProjectOptions,
  useModeEditable,
  useTypeScriptEditable,
  useTailwindEditable,
  setProjectName,
  setRouterMode,
  setTypeScript,
  setTailwind,
} from '@tanstack/cta-ui-base/dist/store/project'

type ProjectConfigProps = {
  hideProjectName?: boolean
}

export function ProjectConfig({ hideProjectName }: ProjectConfigProps) {
  const projectName = useProjectName()
  const routerMode = useRouterMode()
  const modeEditable = useModeEditable()
  const typescriptEditable = useTypeScriptEditable()
  const tailwindEditable = useTailwindEditable()

  const typescript = useProjectOptions((s) => s.typescript)
  const tailwind = useProjectOptions((s) => s.tailwind)

  return (
    <div className="space-y-4">
      {/* Project Name */}
      {!hideProjectName && (
        <div>
          <label
            htmlFor="project-name"
            className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5"
          >
            Project Name
          </label>
          <input
            id="project-name"
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="my-tanstack-app"
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
          />
        </div>
      )}

      {/* Router Mode */}
      <div>
        <div className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          Router Mode
        </div>
        <div className="flex gap-2">
          <ModeButton
            label="File Router"
            description="Routes from file structure"
            isSelected={routerMode === 'file-router'}
            onClick={() => setRouterMode('file-router')}
            disabled={!modeEditable}
          />
          <ModeButton
            label="Code Router"
            description="Routes defined in code"
            isSelected={routerMode === 'code-router'}
            onClick={() => setRouterMode('code-router')}
            disabled={!modeEditable}
          />
        </div>
      </div>

      {/* Feature Toggles */}
      <div className="flex gap-4">
        <FeatureToggle
          label="TypeScript"
          enabled={typescript}
          onChange={setTypeScript}
          disabled={!typescriptEditable}
          icon={
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z" />
            </svg>
          }
        />
        <FeatureToggle
          label="Tailwind"
          enabled={tailwind}
          onChange={setTailwind}
          disabled={!tailwindEditable}
          icon={
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.001 4.8c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.913.228 1.565.89 2.288 1.624C13.666 10.618 15.027 12 18.001 12c3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.913-.228-1.565-.89-2.288-1.624C16.337 6.182 14.976 4.8 12.001 4.8zm-6 7.2c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.913.228 1.565.89 2.288 1.624 1.177 1.194 2.538 2.576 5.512 2.576 3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.913-.228-1.565-.89-2.288-1.624C10.337 13.382 8.976 12 6.001 12z" />
            </svg>
          }
        />
      </div>
    </div>
  )
}

type ModeButtonProps = {
  label: string
  description: string
  isSelected: boolean
  onClick: () => void
  disabled?: boolean
}

function ModeButton({
  label,
  description,
  isSelected,
  onClick,
  disabled,
}: ModeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={twMerge(
        'flex-1 p-3 rounded-lg border-2 text-left transition-all',
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <div
        className={twMerge(
          'text-sm font-medium',
          isSelected
            ? 'text-blue-700 dark:text-blue-300'
            : 'text-gray-900 dark:text-white',
        )}
      >
        {label}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
        {description}
      </div>
    </button>
  )
}

type FeatureToggleProps = {
  label: string
  enabled: boolean
  onChange: (enabled: boolean) => void
  disabled?: boolean
  icon?: React.ReactNode
}

function FeatureToggle({
  label,
  enabled,
  onChange,
  disabled,
  icon,
}: FeatureToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      disabled={disabled}
      className={twMerge(
        'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all',
        enabled
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
      <div
        className={twMerge(
          'w-8 h-5 rounded-full transition-colors relative',
          enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600',
        )}
      >
        <div
          className={twMerge(
            'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
            enabled ? 'translate-x-3.5' : 'translate-x-0.5',
          )}
        />
      </div>
    </button>
  )
}
