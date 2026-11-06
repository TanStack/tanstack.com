import { useParams } from '@tanstack/react-router'
import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs'
import type { ConfigSchema } from '~/utils/config'
import type { MarkdownHeading } from '~/utils/markdown'

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
  items,
  headings,
}: {
  config?: ConfigSchema
  items?: Array<BreadcrumbItem>
  headings?: MarkdownHeading[]
}) {
  const { _splat, framework } = useParams({ strict: false })

  // Build the full doc path as it appears in config
  // Config paths are like "overview" or "framework/react/overview"
  const fullDocPath = framework ? `framework/${framework}/${_splat}` : _splat

  // Find the section for this doc
  const section =
    config && fullDocPath ? findSectionForDoc(config, fullDocPath) : null

  // Keep the section-only mode for callers without a semantic trail.
  if (!section && !items) {
    return null
  }

  return (
    <Breadcrumbs
      section={section ?? ''}
      items={items}
      headings={headings}
      tocHiddenBreakpoint="xl"
    />
  )
}
