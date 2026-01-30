/**
 * Config Panel (v2)
 *
 * Left panel of the builder containing project configuration.
 * Uses proper theme support and design system components.
 */

import { useState, useCallback, useMemo } from 'react'
import { Link } from '@tanstack/react-router'

import {
  Copy,
  Download,
  Share2,
  ChevronDown,
  Rocket,
  Check,
  HelpCircle,
  Search,
  Github,
} from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import {
  useBuilderStore,
  useFeatures,
  useFeatureOptions,
  useTailwind,
  useCompiledOutput,
  useProjectName,
  useFramework,
} from './store'
import { FRAMEWORKS, type FrameworkId } from '~/builder/frameworks'
import reactLogo from '~/images/react-logo.svg'
import solidLogo from '~/images/solid-logo.svg'
import { useCliCommand } from './useBuilderUrl'
import { FeaturePicker, FeatureOptions } from './FeaturePicker'
import { TemplatePicker } from './TemplatePicker'
import { DeployDialog } from './DeployDialog'
import { Button } from '~/ui'
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
} from '~/components/Dropdown'

const DEPLOY_PROVIDERS: Record<
  string,
  {
    name: string
    color: string
    provider: 'cloudflare' | 'netlify' | 'railway'
  }
> = {
  netlify: {
    name: 'Netlify',
    color: '#00C7B7',
    provider: 'netlify',
  },
  cloudflare: {
    name: 'Cloudflare',
    color: '#F38020',
    provider: 'cloudflare',
  },
  railway: {
    name: 'Railway',
    color: '#9B4DCA',
    provider: 'railway',
  },
}

export function ConfigPanel() {
  const projectName = useBuilderStore((s) => s.projectName)
  const setProjectName = useBuilderStore((s) => s.setProjectName)
  const features = useFeatures()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [deployDialogOpen, setDeployDialogOpen] = useState(false)
  const [cliCopied, setCliCopied] = useState(false)
  const cliCommand = useCliCommand()
  const [deployDialogProvider, setDeployDialogProvider] = useState<
    'cloudflare' | 'netlify' | 'railway' | null
  >(null)

  const deployProvider = useMemo(() => {
    const providerId = features.find((f) => DEPLOY_PROVIDERS[f])
    return providerId ? DEPLOY_PROVIDERS[providerId] : null
  }, [features])

  const openDeployDialog = (
    provider: 'cloudflare' | 'netlify' | 'railway' | null,
  ) => {
    setDeployDialogProvider(provider)
    setDeployDialogOpen(true)
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
      {/* Header - Project Name + Build Button */}
      <div className="shrink-0 p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="min-w-[140px] flex-1 h-8 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md px-2 text-gray-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500 focus:border-transparent"
            placeholder="my-tanstack-app"
          />
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(cliCommand)
                  setCliCopied(true)
                  setTimeout(() => setCliCopied(false), 2000)
                }}
                className="shrink-0 h-8 px-2 flex items-center justify-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-600 hover:text-gray-900 dark:hover:text-white transition-colors text-xs font-medium"
                title="Copy CLI command"
              >
                {cliCopied ? (
                  <Check className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                CLI
              </button>
              {cliCopied && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 text-xs font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded shadow-lg whitespace-nowrap z-10">
                  Copied!
                </div>
              )}
            </div>
            <BuildProjectDropdown
              onOpenChange={setDropdownOpen}
              onCreateRepo={() => openDeployDialog(null)}
            />
            {deployProvider && (
              <button
                onClick={() => openDeployDialog(deployProvider.provider)}
                className="shrink-0 h-8 px-2.5 text-xs text-white rounded-md transition-opacity hover:opacity-90 whitespace-nowrap flex items-center gap-1"
                style={{ backgroundColor: deployProvider.color }}
              >
                <Rocket className="w-3.5 h-3.5" />
                <span className="font-medium">Deploy</span>
                <span className="opacity-80 text-[10px]">
                  to {deployProvider.name}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Deploy Dialog */}
      <DeployDialog
        isOpen={deployDialogOpen}
        onClose={() => setDeployDialogOpen(false)}
        provider={deployDialogProvider}
      />

      {/* Content */}
      <div
        className={twMerge(
          'flex-1 overflow-y-auto transition-all duration-200',
          dropdownOpen && 'blur-sm pointer-events-none',
        )}
      >
        {/* Framework Section */}
        <FrameworkPicker />

        {/* Template Presets */}
        <TemplatePicker />

        {/* Integration Search */}
        <IntegrationSearch />

        {/* Styles Section */}
        <div className="p-4 pb-0">
          <StylesPicker />
        </div>

        {/* Package Manager */}
        <div className="p-4 pb-0">
          <PackageManagerPicker />
        </div>

        {/* Feature Picker */}
        <FeaturePicker />

        {/* Feature Options (for selected features with options) */}
        {features.length > 0 && (
          <div className="p-4 pt-0">
            <SelectedFeatureOptions features={features} />
          </div>
        )}
      </div>
    </div>
  )
}

function IntegrationSearch() {
  const search = useBuilderStore((s) => s.integrationSearch)
  const setSearch = useBuilderStore((s) => s.setIntegrationSearch)

  return (
    <div className="p-4 pb-0">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search integrations..."
          className="w-full h-8 pl-7 pr-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500"
        />
      </div>
    </div>
  )
}

function CliOptionsInline() {
  const skipInstall = useBuilderStore((s) => s.skipInstall)
  const setSkipInstall = useBuilderStore((s) => s.setSkipInstall)
  const skipGit = useBuilderStore((s) => s.skipGit)
  const setSkipGit = useBuilderStore((s) => s.setSkipGit)

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600 dark:text-gray-400">
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={skipInstall}
          onChange={(e) => setSkipInstall(e.target.checked)}
          className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-blue-500 dark:text-cyan-500 focus:ring-blue-500 dark:focus:ring-cyan-500"
        />
        <span>No install</span>
      </label>

      <label className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={skipGit}
          onChange={(e) => setSkipGit(e.target.checked)}
          className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-blue-500 dark:text-cyan-500 focus:ring-blue-500 dark:focus:ring-cyan-500"
        />
        <span>No git</span>
      </label>
    </div>
  )
}

const FRAMEWORK_LOGOS: Record<FrameworkId, string> = {
  'react-cra': reactLogo,
  solid: solidLogo,
}

const FRAMEWORK_COLORS: Record<FrameworkId, string> = {
  'react-cra': '#61DAFB',
  solid: '#2C4F7C',
}

function FrameworkPicker() {
  const framework = useFramework()
  const setFramework = useBuilderStore((s) => s.setFramework)

  return (
    <div className="p-4 pb-0">
      <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
        Framework
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Your project's foundation
      </p>
      <div className="space-y-2">
        {FRAMEWORKS.map((fw) => {
          const isSelected = framework === fw.id
          const color = FRAMEWORK_COLORS[fw.id]
          return (
            <button
              key={fw.id}
              onClick={() => setFramework(fw.id)}
              className={twMerge(
                'w-full flex items-center gap-3 p-3 rounded-lg border transition-all',
                isSelected
                  ? 'border-2'
                  : 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
              )}
              style={
                isSelected
                  ? {
                      backgroundColor: `${color}15`,
                      borderColor: `${color}80`,
                    }
                  : undefined
              }
            >
              <div className="w-8 h-8 flex items-center justify-center">
                <img
                  src={FRAMEWORK_LOGOS[fw.id]}
                  alt={fw.name}
                  className="w-full h-full"
                />
              </div>
              <div className="flex-1 text-left">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {fw.name}
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  {fw.description}
                </span>
              </div>
              <div
                className={twMerge(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                  isSelected
                    ? 'border-current'
                    : 'border-gray-300 dark:border-gray-600',
                )}
                style={
                  isSelected
                    ? { backgroundColor: color, borderColor: color }
                    : undefined
                }
              >
                {isSelected && <Check className="w-3 h-3 text-white" />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StylesPicker() {
  const tailwind = useTailwind()
  const setTailwind = useBuilderStore((s) => s.setTailwind)

  return (
    <div>
      <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
        Styles
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Configure styling options
      </p>
      <button
        onClick={() => setTailwind(!tailwind)}
        className={twMerge(
          'w-full flex items-center gap-3 p-3 rounded-lg border transition-all',
          tailwind
            ? 'bg-[#06B6D4]/10 border-[#06B6D4]/50'
            : 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
        )}
      >
        <div
          className={twMerge(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            tailwind ? 'bg-[#06B6D4]/20' : 'bg-gray-100 dark:bg-gray-700',
          )}
        >
          <span className="text-lg">🌊</span>
        </div>
        <div className="flex-1 text-left">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Tailwind CSS
          </span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">
            Utility-first CSS framework
          </span>
        </div>
        <div
          className={twMerge(
            'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
            tailwind
              ? 'bg-[#06B6D4] border-[#06B6D4]'
              : 'border-gray-300 dark:border-gray-600',
          )}
        >
          {tailwind && <Check className="w-3 h-3 text-white" />}
        </div>
      </button>
    </div>
  )
}

const PACKAGE_MANAGERS = ['pnpm', 'npm', 'yarn', 'bun'] as const

function PackageManagerPicker() {
  const packageManager = useBuilderStore((s) => s.packageManager)
  const setPackageManager = useBuilderStore((s) => s.setPackageManager)

  return (
    <div>
      <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
        Package Manager
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        CLI tool for dependencies
      </p>
      <div className="flex gap-1">
        {PACKAGE_MANAGERS.map((pm) => {
          const isSelected = packageManager === pm
          return (
            <button
              key={pm}
              onClick={() => setPackageManager(pm)}
              className={twMerge(
                'flex-1 px-2 py-1.5 text-xs font-medium rounded-md border-2 transition-all',
                isSelected
                  ? 'bg-blue-50 dark:bg-cyan-950 border-blue-500 dark:border-cyan-500 text-blue-700 dark:text-cyan-300'
                  : 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600',
              )}
            >
              {pm}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SelectedFeatureOptions({ features }: { features: Array<string> }) {
  const availableFeatures = useBuilderStore((s) => s.availableFeatures)

  // Only show features that have options
  const featuresWithOptions = features.filter((id) => {
    const feature = availableFeatures.find((f) => f.id === id)
    return feature?.options && feature.options.length > 0
  })

  if (featuresWithOptions.length === 0) return null

  return (
    <div className="border-t border-gray-200 dark:border-gray-800 pt-6">
      <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-4">
        Feature Options
      </h3>
      <div className="space-y-4">
        {featuresWithOptions.map((id) => {
          const feature = availableFeatures.find((f) => f.id === id)
          if (!feature) return null

          return (
            <div
              key={id}
              className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: feature.color ?? '#6b7280' }}
                />
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  {feature.name}
                </h4>
              </div>
              <FeatureOptions featureId={id as any} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BuildProjectDropdown({
  onOpenChange,
  onCreateRepo,
}: {
  onOpenChange?: (open: boolean) => void
  onCreateRepo?: () => void
}) {
  const cliCommand = useCliCommand()
  const features = useFeatures()
  const featureOptions = useFeatureOptions()
  const tailwind = useTailwind()
  const compiledOutput = useCompiledOutput()
  const projectName = useProjectName()
  const [copied, setCopied] = useState<string | null>(null)
  const [showTemplateExport, setShowTemplateExport] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')

  const copyToClipboard = async (text: string, type: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const getDownloadUrl = useCallback(() => {
    if (typeof window === 'undefined') return ''
    const params = new URLSearchParams()
    params.set('name', projectName)
    if (features.length > 0) {
      params.set('features', features.join(','))
    }
    if (!tailwind) {
      params.set('tailwind', 'false')
    }
    for (const [featureId, options] of Object.entries(featureOptions)) {
      for (const [optionKey, value] of Object.entries(options)) {
        if (value !== undefined && value !== null) {
          params.set(`${featureId}.${optionKey}`, String(value))
        }
      }
    }
    return `${window.location.origin}/api/builder/download?${params.toString()}`
  }, [projectName, features, tailwind, featureOptions])

  const downloadZip = useCallback(() => {
    window.location.href = getDownloadUrl()
  }, [getDownloadUrl])

  const generateTemplateJson = () => {
    const template = {
      id: templateName.toLowerCase().replace(/\s+/g, '-') || 'custom-template',
      name: templateName || 'Custom Template',
      description: templateDescription || 'A custom TanStack Start template',
      tailwind,
      features,
    }
    return JSON.stringify(template, null, 2)
  }

  const downloadTemplateJson = () => {
    const json = generateTemplateJson()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${templateName.toLowerCase().replace(/\s+/g, '-') || 'template'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dropdown onOpenChange={onOpenChange}>
      <DropdownTrigger>
        <Button
          variant="primary"
          className="h-8 px-2.5 flex items-center justify-center gap-1 text-xs"
          rounded="md"
        >
          <Download className="w-3.5 h-3.5" />
          Build
          <ChevronDown className="w-3.5 h-3.5" />
        </Button>
      </DropdownTrigger>

      <DropdownContent align="center" sideOffset={8} className="w-96 p-4">
        <div className="space-y-4">
          {/* Create GitHub Repo */}
          <div>
            <Button
              variant="primary"
              className="w-full flex items-center justify-center gap-2"
              onClick={onCreateRepo}
            >
              <Github className="w-4 h-4" />
              Create GitHub Repository
            </Button>
          </div>

          {/* Download ZIP */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
            <div className="flex gap-2">
              <Button
                variant="primary"
                className="flex-1 flex items-center justify-center gap-2"
                onClick={downloadZip}
                disabled={!compiledOutput?.files}
              >
                <Download className="w-4 h-4" />
                Download ZIP
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => copyToClipboard(getDownloadUrl(), 'zip-link')}
                title="Copy download link"
              >
                {copied === 'zip-link' ? (
                  <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Share URL */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
            <div className="flex gap-2 items-center">
              <code className="flex-1 text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1.5 rounded font-mono text-gray-600 dark:text-gray-400 truncate border border-gray-200 dark:border-gray-700">
                {typeof window !== 'undefined' ? window.location.href : ''}
              </code>
              <Button
                onClick={() => copyToClipboard(window.location.href, 'url')}
                variant="ghost"
                size="xs"
                title="Copy share URL"
              >
                {copied === 'url' ? (
                  <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* CLI Command */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
            <div className="flex gap-2 items-start">
              <code className="flex-1 text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded font-mono text-gray-800 dark:text-cyan-400 overflow-x-auto border border-gray-200 dark:border-gray-700 max-h-20">
                {cliCommand}
              </code>
              <Button
                onClick={() => copyToClipboard(cliCommand, 'cli')}
                variant="ghost"
                size="xs"
                title="Copy CLI command"
              >
                {copied === 'cli' ? (
                  <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            <CliOptionsInline />
          </div>

          {/* Save as Template */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
            <button
              onClick={() => setShowTemplateExport(!showTemplateExport)}
              className="w-full flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <span>Save as Template</span>
              <ChevronDown
                className={twMerge(
                  'w-4 h-4 transition-transform',
                  showTemplateExport && 'rotate-180',
                )}
              />
            </button>

            {showTemplateExport && (
              <div className="mt-3 space-y-2">
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name"
                  className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-cyan-500"
                />
                <input
                  type="text"
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Description"
                  className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-cyan-500"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      copyToClipboard(generateTemplateJson(), 'template')
                    }
                    variant="secondary"
                    size="xs"
                    className="flex-1"
                  >
                    {copied === 'template' ? 'Copied!' : 'Copy JSON'}
                  </Button>
                  <Button
                    onClick={downloadTemplateJson}
                    variant="secondary"
                    size="xs"
                    className="flex-1"
                  >
                    Download
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Docs link */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3 text-center">
            <Link
              to="/builder/docs"
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-cyan-400"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              Builder Documentation
            </Link>
          </div>
        </div>
      </DropdownContent>
    </Dropdown>
  )
}
