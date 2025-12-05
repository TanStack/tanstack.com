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
import { FaSave, FaTimes } from 'react-icons/fa'

interface FeedEntryEditorProps {
  entry: FeedEntry | null
  onSave: () => void
  onCancel: () => void
}

const CATEGORIES = [
  'release',
  'announcement',
  'blog',
  'partner',
  'update',
  'other',
] as const

export function FeedEntryEditor({
  entry,
  onSave,
  onCancel,
}: FeedEntryEditorProps) {
  const isNew = entry === null

  const [title, setTitle] = useState(entry?.title || '')
  const [content, setContent] = useState(entry?.content || '')
  const [excerpt, setExcerpt] = useState(entry?.excerpt || '')
  // For new entries, default to 30 days ago to encourage setting the actual publication date
  // For existing entries, use their publishedAt
  const [publishedAt, setPublishedAt] = useState(
    entry
      ? new Date(entry.publishedAt).toISOString().split('T')[0]
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0]
  )
  const [category, setCategory] = useState<
    'release' | 'announcement' | 'blog' | 'partner' | 'update' | 'other'
  >(entry?.category || 'announcement')
  const [selectedLibraries, setSelectedLibraries] = useState<string[]>(
    entry?.libraryIds || []
  )
  const [selectedPartners, setSelectedPartners] = useState<string[]>(
    entry?.partnerIds || []
  )
  const [tags, setTags] = useState<string>(entry?.tags.join(', ') || '')
  const [isVisible, setIsVisible] = useState(entry?.isVisible ?? true)
  const [featured, setFeatured] = useState(entry?.featured ?? false)
  const [showPreview, setShowPreview] = useState(false)
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
        console.log('Creating entry with ID:', entryId)
        await createEntry.mutateAsync({
          id: entryId,
          source: 'announcement',
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
          category,
          isVisible,
          featured,
          autoSynced: false,
        })
        console.log('Entry created successfully')
      } else {
        console.log('Updating entry:', entry.id)
        await updateEntry.mutateAsync({
          id: entry.id,
          title,
          content,
          excerpt: excerpt || undefined,
          publishedAt: new Date(publishedAt).getTime(),
          libraryIds: selectedLibraries,
          partnerIds:
            selectedPartners.length > 0 ? selectedPartners : undefined,
          tags: tagArray,
          category,
          isVisible,
          featured,
        })
        console.log('Entry updated successfully')
      }
      onSave()
    } catch (error) {
      console.error('Error saving entry:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred'
      alert(
        `Failed to save entry: ${errorMessage}\n\nCheck the console for more details.`
      )
    } finally {
      setSaving(false)
    }
  }

  const toggleLibrary = (libraryId: string) => {
    setSelectedLibraries((prev) =>
      prev.includes(libraryId)
        ? prev.filter((id) => id !== libraryId)
        : [...prev, libraryId]
    )
  }

  const togglePartner = (partnerId: string) => {
    setSelectedPartners((prev) =>
      prev.includes(partnerId)
        ? prev.filter((id) => id !== partnerId)
        : [...prev, partnerId]
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {isNew ? 'Create Feed Entry' : 'Edit Feed Entry'}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <FaTimes className="inline mr-2" />
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title || !content || !user}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FaSave className="inline mr-2" />
            {saving ? 'Saving...' : user ? 'Save' : 'Loading...'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Form */}
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              placeholder="Entry title"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium mb-2">Content *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={15}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 font-mono text-sm"
              placeholder="Markdown content"
            />
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Excerpt (optional)
            </label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              placeholder="Short excerpt or leave empty to auto-generate"
            />
          </div>

          {/* Published Date */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Published Date *
            </label>
            <input
              type="date"
              value={publishedAt}
              onChange={(e) => setPublishedAt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-2">Category *</label>
            <select
              value={category}
              onChange={(e) =>
                setCategory(
                  e.target.value as
                    | 'release'
                    | 'announcement'
                    | 'blog'
                    | 'partner'
                    | 'update'
                    | 'other'
                )
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Libraries */}
          <div>
            <label className="block text-sm font-medium mb-2">Libraries</label>
            <div className="max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-2">
              {libraries.map((library) => (
                <label
                  key={library.id}
                  className="flex items-center gap-2 p-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedLibraries.includes(library.id)}
                    onChange={() => toggleLibrary(library.id)}
                    className="rounded"
                  />
                  <span className="text-sm">{library.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Partners */}
          <div>
            <label className="block text-sm font-medium mb-2">Partners</label>
            <div className="max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-2">
              {partners
                .filter((p) => p.status === 'active')
                .map((partner) => (
                  <label
                    key={partner.id}
                    className="flex items-center gap-2 p-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPartners.includes(partner.id)}
                      onChange={() => togglePartner(partner.id)}
                      className="rounded"
                    />
                    <span className="text-sm">{partner.name}</span>
                  </label>
                ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              placeholder="tag1, tag2, tag3"
            />
          </div>

          {/* Toggles */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isVisible}
                onChange={(e) => setIsVisible(e.target.checked)}
                className="rounded"
              />
              <span>Visible</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="rounded"
              />
              <span>Featured</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showPreview}
                onChange={(e) => setShowPreview(e.target.checked)}
                className="rounded"
              />
              <span>Show Preview</span>
            </label>
          </div>
        </div>

        {/* Right Column - Preview */}
        {showPreview && (
          <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800">
            <h2 className="text-lg font-bold mb-4">Preview</h2>
            <div className="prose dark:prose-invert max-w-none">
              <h1>{title || 'Untitled'}</h1>
              <Markdown rawContent={content || '*No content*'} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
