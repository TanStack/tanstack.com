import * as React from 'react'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { libraries } from '~/libraries'
import {
  createBanner,
  updateBanner,
  type BannerWithMeta,
} from '~/utils/banner.functions'
import {
  Save,
  X,
  Link2,
  Settings,
  Eye,
  Calendar,
  Globe,
  BookOpen,
  Info,
  AlertTriangle,
  CheckCircle,
  Gift,
  ExternalLink,
} from 'lucide-react'
import { FormInput } from '~/ui'

interface BannerEditorProps {
  banner: BannerWithMeta | null
  onSave: () => void
  onCancel: () => void
}

const BANNER_STYLES = [
  {
    value: 'info',
    label: 'Info',
    icon: Info,
    bgClass:
      'bg-blue-100 dark:bg-blue-950 border-blue-200 dark:border-blue-800',
    textClass: 'text-blue-900 dark:text-blue-100',
    iconClass: 'text-blue-600 dark:text-blue-400',
  },
  {
    value: 'warning',
    label: 'Warning',
    icon: AlertTriangle,
    bgClass:
      'bg-amber-100 dark:bg-amber-950 border-amber-200 dark:border-amber-800',
    textClass: 'text-amber-900 dark:text-amber-100',
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
  {
    value: 'success',
    label: 'Success',
    icon: CheckCircle,
    bgClass:
      'bg-green-100 dark:bg-green-950 border-green-200 dark:border-green-800',
    textClass: 'text-green-900 dark:text-green-100',
    iconClass: 'text-green-600 dark:text-green-400',
  },
  {
    value: 'promo',
    label: 'Promo',
    icon: Gift,
    bgClass:
      'bg-purple-100 dark:bg-purple-950 border-purple-200 dark:border-purple-800',
    textClass: 'text-purple-900 dark:text-purple-100',
    iconClass: 'text-purple-600 dark:text-purple-400',
  },
] as const

type BannerStyle = (typeof BANNER_STYLES)[number]['value']
type BannerScope = 'global' | 'targeted'

export function BannerEditor({ banner, onSave, onCancel }: BannerEditorProps) {
  const isNew = banner === null
  const queryClient = useQueryClient()

  // Form state
  const [title, setTitle] = useState(banner?.title || '')
  const [content, setContent] = useState(banner?.content || '')
  const [linkUrl, setLinkUrl] = useState(banner?.linkUrl || '')
  const [linkText, setLinkText] = useState(banner?.linkText || '')
  const [style, setStyle] = useState<BannerStyle>(banner?.style ?? 'info')
  const [scope, setScope] = useState<BannerScope>(banner?.scope ?? 'global')
  const [pathPrefixes, setPathPrefixes] = useState<string[]>(
    banner?.pathPrefixes ?? [],
  )
  const [newPathPrefix, setNewPathPrefix] = useState('')
  const [isActive, setIsActive] = useState(banner?.isActive ?? true)
  const [startsAt, setStartsAt] = useState(
    banner?.startsAt
      ? new Date(banner.startsAt).toISOString().slice(0, 16)
      : '',
  )
  const [expiresAt, setExpiresAt] = useState(
    banner?.expiresAt
      ? new Date(banner.expiresAt).toISOString().slice(0, 16)
      : '',
  )
  const [priority, setPriority] = useState(banner?.priority ?? 0)
  const [saving, setSaving] = useState(false)

  // Mutations
  const createMutation = useMutation({
    mutationFn: createBanner,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banners'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: updateBanner,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banners'] })
    },
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      if (isNew) {
        await createMutation.mutateAsync({
          data: {
            title,
            content: content || undefined,
            linkUrl: linkUrl || undefined,
            linkText: linkText || undefined,
            style,
            scope,
            pathPrefixes,
            isActive,
            startsAt: startsAt ? new Date(startsAt).getTime() : undefined,
            expiresAt: expiresAt ? new Date(expiresAt).getTime() : undefined,
            priority,
          },
        })
      } else {
        await updateMutation.mutateAsync({
          data: {
            id: banner.id,
            title,
            content: content || undefined,
            linkUrl: linkUrl || undefined,
            linkText: linkText || undefined,
            style,
            scope,
            pathPrefixes,
            isActive,
            startsAt: startsAt ? new Date(startsAt).getTime() : null,
            expiresAt: expiresAt ? new Date(expiresAt).getTime() : null,
            priority,
          },
        })
      }
      onSave()
    } catch (error) {
      console.error('Error saving banner:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Failed to save banner: ${errorMessage}`)
    } finally {
      setSaving(false)
    }
  }

  const addPathPrefix = (prefix: string) => {
    const normalizedPrefix = prefix.startsWith('/') ? prefix : `/${prefix}`
    if (!pathPrefixes.includes(normalizedPrefix)) {
      setPathPrefixes((prev) => [...prev, normalizedPrefix])
    }
    setNewPathPrefix('')
  }

  const removePathPrefix = (prefix: string) => {
    setPathPrefixes((prev) => prev.filter((p) => p !== prefix))
  }

  const isValid = title.trim().length > 0
  const currentStyle =
    BANNER_STYLES.find((s) => s.value === style) || BANNER_STYLES[0]

  // Repeated class patterns
  const cardClass =
    'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden'
  const cardHeaderClass =
    'px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
  const labelClass =
    'block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2'

  return (
    <div className="min-h-full">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 -mx-8 px-8 py-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isNew ? 'Create Banner' : 'Edit Banner'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {isNew
                ? 'Create a new site-wide banner'
                : `Editing: ${banner?.title}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !isValid}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Banner'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left Column - Form */}
        <div className="space-y-6">
          {/* Content Card */}
          <div className={cardClass}>
            <div className={cardHeaderClass}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    Banner Content
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Title and message for the banner
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-5">
              {/* Title */}
              <div>
                <label htmlFor="title" className={labelClass}>
                  Title <span className="text-red-500">*</span>
                </label>
                <FormInput
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter banner title"
                />
              </div>

              {/* Content */}
              <div>
                <label htmlFor="content" className={labelClass}>
                  Description
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    (Optional - shown below title)
                  </span>
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  placeholder="Optional additional details"
                />
              </div>
            </div>
          </div>

          {/* Link Card */}
          <div className={cardClass}>
            <div className={cardHeaderClass}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Link2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    Link (Optional)
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Make the banner clickable
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-5">
              {/* Link URL */}
              <div>
                <label htmlFor="linkUrl" className={labelClass}>
                  Link URL
                </label>
                <FormInput
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com/page"
                />
              </div>

              {/* Link Text */}
              <div>
                <label htmlFor="linkText" className={labelClass}>
                  Link Text
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    (Button text - defaults to "Learn More")
                  </span>
                </label>
                <FormInput
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="Learn More"
                />
              </div>
            </div>
          </div>

          {/* Style & Targeting Card */}
          <div className={cardClass}>
            <div className={cardHeaderClass}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Settings className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    Style & Targeting
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Appearance and where to show the banner
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-5">
              {/* Banner Style */}
              <div>
                <label
                  htmlFor="style"
                  className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-3"
                >
                  Banner Style
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {BANNER_STYLES.map((s) => {
                    const Icon = s.icon
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setStyle(s.value)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                          style === s.value
                            ? `border-current ${s.bgClass} ${s.textClass}`
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                      >
                        <Icon
                          className={`w-5 h-5 ${style === s.value ? s.iconClass : 'text-gray-400'}`}
                        />
                        <span
                          className={`text-xs font-medium ${style === s.value ? '' : 'text-gray-600 dark:text-gray-400'}`}
                        >
                          {s.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Banner Scope */}
              <div>
                <label
                  htmlFor="scope"
                  className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-3"
                >
                  Banner Scope
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setScope('global')}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                      scope === 'global'
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <Globe
                      className={`w-5 h-5 ${scope === 'global' ? 'text-purple-500' : 'text-gray-400'}`}
                    />
                    <div className="text-left">
                      <div
                        className={`font-medium ${scope === 'global' ? 'text-purple-700 dark:text-purple-300' : 'text-gray-600 dark:text-gray-400'}`}
                      >
                        Global
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Show on all pages
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScope('targeted')}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                      scope === 'targeted'
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <BookOpen
                      className={`w-5 h-5 ${scope === 'targeted' ? 'text-purple-500' : 'text-gray-400'}`}
                    />
                    <div className="text-left">
                      <div
                        className={`font-medium ${scope === 'targeted' ? 'text-purple-700 dark:text-purple-300' : 'text-gray-600 dark:text-gray-400'}`}
                      >
                        Targeted
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Only on specific paths
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Path Prefix Selection - Only show if scope is targeted */}
              {scope === 'targeted' && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Show Banner On Paths
                    {pathPrefixes.length > 0 && (
                      <span className="ml-2 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full">
                        {pathPrefixes.length} path
                        {pathPrefixes.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </label>

                  {/* Quick add library paths */}
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Quick add library:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {libraries
                        .filter(
                          (lib) => !('visible' in lib) || lib.visible !== false,
                        )
                        .map((library) => (
                          <button
                            key={library.id}
                            type="button"
                            onClick={() => addPathPrefix(`/${library.id}`)}
                            disabled={pathPrefixes.includes(`/${library.id}`)}
                            className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                              pathPrefixes.includes(`/${library.id}`)
                                ? 'bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-600 dark:hover:text-purple-400'
                            }`}
                          >
                            {library.name}
                          </button>
                        ))}
                    </div>
                  </div>

                  {/* Custom path input */}
                  <div className="flex gap-2 mb-3">
                    <FormInput
                      type="text"
                      value={newPathPrefix}
                      onChange={(e) => setNewPathPrefix(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newPathPrefix.trim()) {
                          e.preventDefault()
                          addPathPrefix(newPathPrefix.trim())
                        }
                      }}
                      placeholder="/custom/path"
                      focusRing="purple"
                      className="flex-1 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newPathPrefix.trim()) {
                          addPathPrefix(newPathPrefix.trim())
                        }
                      }}
                      disabled={!newPathPrefix.trim()}
                      className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>

                  {/* Selected paths */}
                  {pathPrefixes.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {pathPrefixes.map((prefix) => (
                        <span
                          key={prefix}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm"
                        >
                          <code className="text-xs">{prefix}</code>
                          <button
                            type="button"
                            onClick={() => removePathPrefix(prefix)}
                            className="text-purple-500 hover:text-purple-700 dark:hover:text-purple-200"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Scheduling Card */}
          <div className={cardClass}>
            <div className={cardHeaderClass}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <Calendar className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    Scheduling
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    When the banner should be active
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-5">
              {/* Active Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <label htmlFor="isActive">
                  <div className="font-medium text-gray-900 dark:text-white">
                    Active
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Banner will only show when active
                  </div>
                </label>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`w-11 h-6 rounded-full transition-colors ${isActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform mt-0.5 ${isActive ? 'translate-x-5.5 ml-0.5' : 'translate-x-0.5'}`}
                    />
                  </div>
                </div>
              </div>

              {/* Start Date */}
              <div>
                <label htmlFor="startsAt" className={labelClass}>
                  Start Date & Time
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    (Optional - shows immediately if empty)
                  </span>
                </label>
                <FormInput
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  focusRing="orange"
                />
              </div>

              {/* End Date */}
              <div>
                <label htmlFor="expiresAt" className={labelClass}>
                  End Date & Time
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    (Optional - never expires if empty)
                  </span>
                </label>
                <FormInput
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  focusRing="orange"
                />
              </div>

              {/* Priority */}
              <div>
                <label htmlFor="priority" className={labelClass}>
                  Priority
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    (Higher = shown first when multiple banners match)
                  </span>
                </label>
                <FormInput
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                  focusRing="orange"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Live Preview */}
        <div className="xl:sticky xl:top-24 xl:self-start">
          <div className={cardClass}>
            <div className={cardHeaderClass}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                  <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    Live Preview
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    How the banner will appear to users
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              {/* Banner Preview */}
              <div
                className={`p-4 rounded-lg border ${currentStyle.bgClass} ${currentStyle.textClass}`}
              >
                <div className="flex items-start gap-3">
                  <currentStyle.icon
                    className={`w-5 h-5 mt-0.5 flex-shrink-0 ${currentStyle.iconClass}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{title || 'Banner Title'}</div>
                    {content && (
                      <div className="text-sm opacity-90 mt-0.5">{content}</div>
                    )}
                    {linkUrl && (
                      <a
                        href={linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium underline hover:no-underline"
                      >
                        {linkText || 'Learn More'}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    className="text-current opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                Users can dismiss the banner by clicking the X button.
              </p>

              {/* Status Summary */}
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  Status Summary
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400">
                      Status
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        isActive
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400">
                      Scope
                    </span>
                    <span className="text-gray-900 dark:text-white capitalize">
                      {scope}
                    </span>
                  </div>
                  {scope === 'targeted' && pathPrefixes.length > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400">
                        Paths
                      </span>
                      <span className="text-gray-900 dark:text-white">
                        {pathPrefixes.length} path
                        {pathPrefixes.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  {startsAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400">
                        Starts
                      </span>
                      <span className="text-gray-900 dark:text-white">
                        {new Date(startsAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {expiresAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400">
                        Expires
                      </span>
                      <span className="text-gray-900 dark:text-white">
                        {new Date(expiresAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400">
                      Priority
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      {priority}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
