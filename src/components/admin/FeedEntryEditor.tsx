import * as React from 'react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FeedEntry } from '~/components/FeedEntry'
import { Markdown } from '~/components/Markdown'
import { libraries } from '~/libraries'
import { partners } from '~/utils/partners'
import { currentUserQueryOptions } from '~/queries/auth'
import { useCreateFeedEntry, useUpdateFeedEntry } from '~/utils/mutations'
import { generateManualEntryId } from '~/utils/feed-manual'
import {
  Save,
  X,
  FileText,
  Tags,
  Settings,
  Eye,
  Calendar,
  Check,
} from 'lucide-react'

interface FeedEntryEditorProps {
  entry: FeedEntry | null
  onSave: () => void
  onCancel: () => void
}

export function FeedEntryEditor({
  entry,
  onSave,
  onCancel,
}: FeedEntryEditorProps) {
  const isNew = entry === null

  const [title, setTitle] = useState(entry?.title || '')
  const [content, setContent] = useState(entry?.content || '')
  const [excerpt, setExcerpt] = useState(entry?.excerpt || '')
  const [publishedAt, setPublishedAt] = useState(
    entry
      ? new Date(entry.publishedAt).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
  )
  // All manually created entries are announcements
  const entryType = 'announcement' as const
  const [selectedLibraries, setSelectedLibraries] = useState<string[]>(
    entry?.libraryIds || [],
  )
  const [selectedPartners, setSelectedPartners] = useState<string[]>(
    entry?.partnerIds || [],
  )
  const [tags, setTags] = useState<string>(entry?.tags.join(', ') || '')
  const [showInFeed, setShowInFeed] = useState(entry?.showInFeed ?? true)
  const [featured, setFeatured] = useState(entry?.featured ?? false)
  const [saving, setSaving] = useState(false)

  const userQuery = useQuery(currentUserQueryOptions())
  const user = userQuery.data
  const createEntry = useCreateFeedEntry()
  const updateEntry = useUpdateFeedEntry()

  const handleSave = async () => {
    if (!user) {
      alert('User not loaded. Please wait and try again.')
      return
    }

    if (!user.userId) {
      alert('User ID is missing. Please refresh the page and try again.')
      return
    }

    setSaving(true)
    try {
      const tagArray = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      if (isNew) {
        const entryId = generateManualEntryId()
        await createEntry.mutateAsync({
          id: entryId,
          entryType,
          title,
          content,
          excerpt: excerpt || undefined,
          publishedAt: new Date(publishedAt).getTime(),
          metadata: {
            createdBy: user.userId,
          },
          libraryIds: selectedLibraries,
          partnerIds:
            selectedPartners.length > 0 ? selectedPartners : undefined,
          tags: tagArray,
          showInFeed,
          featured,
          autoSynced: false,
        })
      } else {
        await updateEntry.mutateAsync({
          id: entry.id,
          entryType,
          title,
          content,
          excerpt: excerpt || undefined,
          publishedAt: new Date(publishedAt).getTime(),
          libraryIds: selectedLibraries,
          partnerIds:
            selectedPartners.length > 0 ? selectedPartners : undefined,
          tags: tagArray,
          showInFeed,
          featured,
        })
      }
      onSave()
    } catch (error) {
      console.error('Error saving entry:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred'
      alert(
        `Failed to save entry: ${errorMessage}\n\nCheck the console for more details.`,
      )
    } finally {
      setSaving(false)
    }
  }

  const toggleLibrary = (libraryId: string) => {
    setSelectedLibraries((prev) =>
      prev.includes(libraryId)
        ? prev.filter((id) => id !== libraryId)
        : [...prev, libraryId],
    )
  }

  const togglePartner = (partnerId: string) => {
    setSelectedPartners((prev) =>
      prev.includes(partnerId)
        ? prev.filter((id) => id !== partnerId)
        : [...prev, partnerId],
    )
  }

  const isValid = title.trim() && content.trim() && user

  // Repeated class patterns
  const cardClass =
    'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden'
  const cardHeaderClass =
    'px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
  const labelClass =
    'block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2'
  const inputClass =
    'w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow'
  const chipBase = 'px-3 py-1.5 rounded-full text-sm font-medium transition-all'
  const chipUnselected =
    'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'

  return (
    <div className="min-h-full">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 -mx-8 px-8 py-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isNew ? 'Create Announcement' : 'Edit Entry'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {isNew
                ? 'Create a new announcement for the feed'
                : `Editing: ${entry?.title}`}
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
              {saving ? 'Saving...' : 'Save Entry'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left Column - Form */}
        <div className="space-y-6">
          {/* Basic Information Card */}
          <div className={cardClass}>
            <div className={cardHeaderClass}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    Basic Information
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Title, content, and publication details
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
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputClass}
                  placeholder="Enter a descriptive title"
                />
              </div>

              {/* Content */}
              <div>
                <label htmlFor="content" className={labelClass}>
                  Content <span className="text-red-500">*</span>
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    (Markdown supported)
                  </span>
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={12}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  placeholder="Write your announcement content here..."
                />
              </div>

              {/* Excerpt */}
              <div>
                <label htmlFor="excerpt" className={labelClass}>
                  Excerpt
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    (Optional - auto-generated if empty)
                  </span>
                </label>
                <textarea
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  rows={2}
                  className={inputClass}
                  placeholder="Brief summary for feed previews"
                />
              </div>

              {/* Published Date */}
              <div>
                <label htmlFor="publishedAt" className={labelClass}>
                  <Calendar className="inline mr-2 w-4 h-4 text-gray-400" />
                  Published Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={publishedAt}
                  onChange={(e) => setPublishedAt(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Categorization Card */}
          <div className={cardClass}>
            <div className={cardHeaderClass}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Tags className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    Categorization
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Category, libraries, and tags
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-5">
              {/* Libraries */}
              <div>
                <label className={labelClass}>
                  Related Libraries
                  {selectedLibraries.length > 0 && (
                    <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                      {selectedLibraries.length} selected
                    </span>
                  )}
                </label>
                <div className="flex flex-wrap gap-2">
                  {libraries.map((library) => (
                    <button
                      key={library.id}
                      type="button"
                      onClick={() => toggleLibrary(library.id)}
                      className={`${chipBase} ${
                        selectedLibraries.includes(library.id)
                          ? 'bg-blue-600 text-white'
                          : chipUnselected
                      }`}
                    >
                      {selectedLibraries.includes(library.id) && (
                        <Check className="inline mr-1.5 w-3 h-3" />
                      )}
                      {library.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Partners */}
              <div>
                <label className={labelClass}>
                  Related Partners
                  {selectedPartners.length > 0 && (
                    <span className="ml-2 text-xs bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 px-2 py-0.5 rounded-full">
                      {selectedPartners.length} selected
                    </span>
                  )}
                </label>
                <div className="flex flex-wrap gap-2">
                  {partners
                    .filter((p) => p.status === 'active')
                    .map((partner) => (
                      <button
                        key={partner.id}
                        type="button"
                        onClick={() => togglePartner(partner.id)}
                        className={`${chipBase} ${
                          selectedPartners.includes(partner.id)
                            ? 'bg-pink-600 text-white'
                            : chipUnselected
                        }`}
                      >
                        {selectedPartners.includes(partner.id) && (
                          <Check className="inline mr-1.5 w-3 h-3" />
                        )}
                        {partner.name}
                      </button>
                    ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <label htmlFor="tags" className={labelClass}>
                  Tags
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    (comma-separated)
                  </span>
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className={inputClass}
                  placeholder="e.g., release:major, breaking-change"
                />
              </div>
            </div>
          </div>

          {/* Display Options Card */}
          <div className={cardClass}>
            <div className={cardHeaderClass}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Settings className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    Display Options
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Visibility and featuring settings
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {[
                  {
                    id: 'showInFeed',
                    label: 'Show in Feed',
                    description: 'Display this entry in the public feed',
                    checked: showInFeed,
                    onChange: setShowInFeed,
                    activeColor: 'bg-green-500',
                  },
                  {
                    id: 'featured',
                    label: 'Featured',
                    description: 'Highlight this entry in the feed',
                    checked: featured,
                    onChange: setFeatured,
                    activeColor: 'bg-yellow-500',
                  },
                ].map(
                  ({ id, label, description, checked, onChange, activeColor }) => (
                    <div
                      key={id}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <label htmlFor={id}>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {label}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {description}
                        </div>
                      </label>
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => onChange(e.target.checked)}
                          className="sr-only"
                        />
                        <div
                          className={`w-11 h-6 rounded-full transition-colors ${checked ? activeColor : 'bg-gray-300 dark:bg-gray-600'}`}
                        >
                          <div
                            className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform mt-0.5 ${checked ? 'translate-x-5.5 ml-0.5' : 'translate-x-0.5'}`}
                          />
                        </div>
                      </div>
                    </div>
                  ),
                )}
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
                    How it will appear in the feed
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              {title || content ? (
                <div className="prose dark:prose-invert prose-sm max-w-none">
                  <h2 className="text-xl font-bold mt-0 mb-4">
                    {title || 'Untitled'}
                  </h2>
                  {excerpt && (
                    <p className="text-gray-600 dark:text-gray-400 italic border-l-4 border-gray-200 dark:border-gray-700 pl-4 mb-4">
                      {excerpt}
                    </p>
                  )}
                  <Markdown rawContent={content || '*No content yet*'} />
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>Start typing to see a preview</p>
                </div>
              )}
            </div>

            {/* Preview Metadata */}
            {(selectedLibraries.length > 0 ||
              selectedPartners.length > 0 ||
              tags) && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex flex-wrap gap-2">
                  {selectedLibraries.map((id) => {
                    const lib = libraries.find((l) => l.id === id)
                    return lib ? (
                      <span
                        key={id}
                        className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full"
                      >
                        {lib.name}
                      </span>
                    ) : null
                  })}
                  {selectedPartners.map((id) => {
                    const partner = partners.find((p) => p.id === id)
                    return partner ? (
                      <span
                        key={id}
                        className="px-2 py-1 text-xs bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-full"
                      >
                        {partner.name}
                      </span>
                    ) : null
                  })}
                  {tags
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
