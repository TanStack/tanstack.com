import { useParams } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import type { ConfigSchema } from '~/utils/config'

function findSectionForDoc(
  config: ConfigSchema,
  docPath: string,
): string | null {
  for (const section of config.sections) {
    // Check core docs
    for (const child of section.children) {
      if (child.to === docPath) {
        return section.label
      }
    }

    // Check framework-specific docs in all frameworks
    if (section.frameworks) {
      for (const frameworkSection of section.frameworks) {
        for (const child of frameworkSection.children) {
          if (child.to === docPath) {
            return section.label
          }
        }
      }
    }
  }

  return null
}

export function DocBreadcrumb({
  config,
  title,
}: {
  config: ConfigSchema
  title: string
}) {
  const { _splat, framework } = useParams({ strict: false })

  // Build the full doc path as it appears in config
  // Config paths are like "overview" or "framework/react/overview"
  const fullDocPath = framework ? `framework/${framework}/${_splat}` : _splat

  // Find the section for this doc
  const section = fullDocPath ? findSectionForDoc(config, fullDocPath) : null

  // Only show if we found a section
  if (!section) {
    return null
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
    >
      <span>{section}</span>
      <ChevronRight className="w-3.5 h-3.5 opacity-50 shrink-0" />
      <span className="text-gray-700 dark:text-gray-200 font-medium truncate max-w-[300px]">
        {title}
      </span>
    </nav>
  )
}
