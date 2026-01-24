/**
 * Config Panel (v2)
 *
 * Left panel of the builder containing project configuration.
 * Uses proper theme support and design system components.
 */

import { useState, useCallback, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import JSZip from 'jszip'
import {
  Copy,
  Download,
  Share2,
  ChevronDown,
  Plus,
  Rocket,
  Sparkles,
  LayoutDashboard,
  FileText,
  Server,
  Radio,
  Globe,
  Database,
  Cpu,
  Check,
  HelpCircle,
  Loader2,
  Search,
  Github,
} from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import {
  useBuilderStore,
  useFeatures,
  useFeatureOptions,
  useAvailableTemplates,
  useTailwind,
  useCompiledOutput,
  useProjectName,
} from './store'
import { useCliCommand } from './useBuilderUrl'
import { FeaturePicker, FeatureOptions } from './FeaturePicker'
import { CustomTemplateItem } from './CustomTemplateDialog'
import { DeployDialog } from './DeployDialog'
import { Button } from '~/ui'
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
} from '~/components/Dropdown'

const TEMPLATE_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  plus: Plus,
  rocket: Rocket,
  sparkles: Sparkles,
  layout: LayoutDashboard,
  'file-text': FileText,
  server: Server,
  radio: Radio,
  globe: Globe,
  database: Database,
  cpu: Cpu,
}

const TEMPLATE_COLORS: Record<string, { bg: string; text: string }> = {
  plus: {
    bg: 'bg-gray-100 dark:bg-gray-700',
    text: 'text-gray-600 dark:text-gray-400',
  },
  rocket: {
    bg: 'bg-cyan-100 dark:bg-cyan-900/50',
    text: 'text-cyan-600 dark:text-cyan-400',
  },
  sparkles: {
    bg: 'bg-purple-100 dark:bg-purple-900/50',
    text: 'text-purple-600 dark:text-purple-400',
  },
  layout: {
    bg: 'bg-blue-100 dark:bg-blue-900/50',
    text: 'text-blue-600 dark:text-blue-400',
  },
  'file-text': {
    bg: 'bg-amber-100 dark:bg-amber-900/50',
    text: 'text-amber-600 dark:text-amber-400',
  },
  server: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/50',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  radio: {
    bg: 'bg-orange-100 dark:bg-orange-900/50',
    text: 'text-orange-600 dark:text-orange-400',
  },
  globe: {
    bg: 'bg-indigo-100 dark:bg-indigo-900/50',
    text: 'text-indigo-600 dark:text-indigo-400',
  },
  database: {
    bg: 'bg-teal-100 dark:bg-teal-900/50',
    text: 'text-teal-600 dark:text-teal-400',
  },
  cpu: {
    bg: 'bg-violet-100 dark:bg-violet-900/50',
    text: 'text-violet-600 dark:text-violet-400',
  },
}

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
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="min-w-0 flex-1 h-8 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md px-2 text-gray-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500 focus:border-transparent"
            placeholder="my-tanstack-app"
          />
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
        <div className="p-4 pb-0">
          <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Framework
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Your project's foundation
          </p>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-100 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-600 cursor-not-allowed">
            <div className="w-8 h-8 flex items-center justify-center">
              <img
                src="/images/logos/logo-black.svg"
                alt="TanStack"
                className="w-full h-full dark:hidden"
              />
              <img
                src="/images/logos/logo-white.svg"
                alt="TanStack"
                className="w-full h-full hidden dark:block"
              />
            </div>
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                TanStack Start
              </span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">
                Full-stack React with TanStack Router
              </span>
            </div>
            <div className="w-5 h-5 rounded-full bg-blue-500 dark:bg-cyan-500 flex items-center justify-center">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
          </div>
        </div>

        {/* Template Section */}
        <div className="p-4 pb-0">
          <TemplatePicker />
        </div>

        {/* Integration Search */}
        <IntegrationSearch />

        {/* Styles Section */}
        <div className="p-4 pb-0">
          <StylesPicker />
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

const PACKAGE_MANAGERS = ['pnpm', 'npm', 'yarn', 'bun'] as const

function CliOptionsInline() {
  const packageManager = useBuilderStore((s) => s.packageManager)
  const setPackageManager = useBuilderStore((s) => s.setPackageManager)
  const skipInstall = useBuilderStore((s) => s.skipInstall)
  const setSkipInstall = useBuilderStore((s) => s.setSkipInstall)
  const skipGit = useBuilderStore((s) => s.skipGit)
  const setSkipGit = useBuilderStore((s) => s.setSkipGit)

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600 dark:text-gray-400">
      <select
        value={packageManager}
        onChange={(e) =>
          setPackageManager(e.target.value as (typeof PACKAGE_MANAGERS)[number])
        }
        className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-cyan-500"
      >
        {PACKAGE_MANAGERS.map((pm) => (
          <option key={pm} value={pm}>
            {pm}
          </option>
        ))}
      </select>

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

function TemplatePicker() {
  const templates = useAvailableTemplates()
  const applyTemplate = useBuilderStore((s) => s.applyTemplate)
  const features = useFeatures()
  const [customExpanded, setCustomExpanded] = useState(false)

  if (templates.length === 0) return null

  return (
    <div>
      <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
        Template
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Start blank or with pre-configured integrations
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2 gap-2">
        {templates.map((template) => {
          const isActive =
            JSON.stringify((template.features ?? []).sort()) ===
            JSON.stringify([...features].sort())
          const Icon = TEMPLATE_ICONS[template.icon || 'plus'] || Plus
          const colors =
            TEMPLATE_COLORS[template.icon || 'plus'] || TEMPLATE_COLORS.plus

          const addonCount = template.features?.length ?? 0

          return (
            <button
              key={template.id}
              onClick={() => applyTemplate(template)}
              className={twMerge(
                'p-3 rounded-lg border text-left transition-all flex items-start gap-2',
                isActive
                  ? 'bg-blue-50 dark:bg-cyan-900/30 border-blue-500 dark:border-cyan-500'
                  : 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800',
              )}
            >
              <div
                className={twMerge(
                  'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  colors.bg,
                  colors.text,
                )}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={twMerge(
                      'font-medium text-sm',
                      isActive
                        ? 'text-blue-700 dark:text-cyan-300'
                        : 'text-gray-900 dark:text-gray-100',
                    )}
                  >
                    {template.name}
                  </span>
                  {addonCount > 0 && (
                    <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">
                      {addonCount}{' '}
                      {addonCount === 1 ? 'integration' : 'integrations'}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                  {template.description}
                </div>
              </div>
            </button>
          )
        })}
        <CustomTemplateItem
          isExpanded={customExpanded}
          onToggle={() => setCustomExpanded(!customExpanded)}
        />
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
  const [isGeneratingZip, setIsGeneratingZip] = useState(false)

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

  const downloadZip = useCallback(async () => {
    if (!compiledOutput?.files) return

    setIsGeneratingZip(true)
    try {
      const zip = new JSZip()
      const rootFolder = zip.folder(projectName)
      if (!rootFolder) return

      for (const [filePath, content] of Object.entries(compiledOutput.files)) {
        rootFolder.file(filePath, content)
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${projectName}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setIsGeneratingZip(false)
    }
  }, [compiledOutput?.files, projectName])

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
                disabled={!compiledOutput?.files || isGeneratingZip}
              >
                {isGeneratingZip ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {isGeneratingZip ? 'Generating...' : 'Download ZIP'}
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
