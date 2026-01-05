import { createFileRoute } from '@tanstack/react-router'
import { setResponseHeader } from '@tanstack/react-start/server'
import {
  libraries,
  librariesByGroup,
  librariesGroupNamesMap,
} from '~/libraries'
import type { Library } from '~/libraries'

export const Route = createFileRoute('/llms.txt')({
  // @ts-ignore server property not in route types yet
  server: {
    handlers: {
      GET: async () => {
        const content = generateLlmsTxt()

        // Cache aggressively - this content changes rarely
        setResponseHeader('Content-Type', 'text/plain; charset=utf-8')
        setResponseHeader('Cache-Control', 'public, max-age=0, must-revalidate')
        setResponseHeader(
          'CDN-Cache-Control',
          'max-age=86400, stale-while-revalidate=86400, durable',
        )

        return new Response(content)
      },
    },
  },
})

function generateLlmsTxt(): string {
  const lines: string[] = []

  // Header
  lines.push('# TanStack')
  lines.push('')
  lines.push(
    '> TanStack provides high-quality, open-source libraries for web development including routing, data fetching, state management, tables, forms, and more. All libraries are framework-agnostic with first-class support for React, Vue, Solid, Svelte, and Angular.',
  )
  lines.push('')

  // Main documentation
  lines.push('## Documentation')
  lines.push('')

  // Group libraries by category
  for (const [groupKey, groupLibraries] of Object.entries(librariesByGroup)) {
    const groupName =
      librariesGroupNamesMap[groupKey as keyof typeof librariesGroupNamesMap]
    lines.push(`### ${groupName}`)
    lines.push('')

    for (const lib of groupLibraries) {
      const library = lib as Library
      if (!library.name || !library.tagline) continue

      const docsUrl = library.defaultDocs
        ? `https://tanstack.com/${library.id}/latest/docs/${library.defaultDocs}`
        : `https://tanstack.com/${library.id}`

      lines.push(`- [${library.name}](${docsUrl}): ${library.tagline}`)
    }
    lines.push('')
  }

  // Individual library details with key links
  lines.push('## Libraries')
  lines.push('')

  for (const lib of libraries) {
    const library = lib as Library
    if (!library.name || !library.description) continue

    lines.push(`### ${library.name}`)
    lines.push('')
    lines.push(library.description)
    lines.push('')

    // Key links
    const links: string[] = []

    if (library.defaultDocs) {
      links.push(
        `- [Documentation](https://tanstack.com/${library.id}/latest/docs/${library.defaultDocs})`,
      )
    }

    if (library.repo) {
      links.push(`- [GitHub](https://github.com/${library.repo})`)
    }

    // Add installation link if available
    if (library.installPath) {
      links.push(
        `- [Installation](https://tanstack.com/${library.id}/latest/docs/${library.installPath.replace('$framework', 'react')})`,
      )
    }

    if (links.length > 0) {
      lines.push(...links)
      lines.push('')
    }

    // Supported frameworks
    if (library.frameworks && library.frameworks.length > 0) {
      lines.push(`Supported frameworks: ${library.frameworks.join(', ')}`)
      lines.push('')
    }
  }

  // Optional section for less critical content
  lines.push('## Optional')
  lines.push('')
  lines.push(
    '- [NPM Stats](https://tanstack.com/stats/npm): Compare npm package download statistics',
  )
  lines.push('- [Blog](https://tanstack.com/blog): Latest news and updates')
  lines.push('')

  return lines.join('\n')
}
