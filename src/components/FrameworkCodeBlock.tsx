import * as React from 'react'
import { useLocalCurrentFramework } from './FrameworkSelect'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { useParams } from '@tanstack/react-router'
import { FileTabs } from './FileTabs'
import type { Framework } from '~/libraries/types'

type CodeBlockMeta = {
  title: string
  code: string
  language: string
}

type FrameworkCodeBlockProps = {
  id: string
  codeBlocksByFramework: Record<string, CodeBlockMeta[]>
  availableFrameworks: string[]
  /** Pre-rendered React children for each framework (from domToReact) */
  panelsByFramework: Record<string, React.ReactNode>
}

/**
 * Renders code blocks for the currently selected framework.
 * - If no blocks for framework: shows nothing
 * - If 1 block: shows just the code block (minimal style)
 * - If multiple blocks: shows as FileTabs (file tabs with names)
 */
export function FrameworkCodeBlock({
  id,
  codeBlocksByFramework,
  panelsByFramework,
}: FrameworkCodeBlockProps) {
  const { framework: paramsFramework } = useParams({ strict: false })
  const localCurrentFramework = useLocalCurrentFramework()
  const userQuery = useCurrentUserQuery()
  const userFramework = userQuery.data?.lastUsedFramework

  const actualFramework = (paramsFramework ||
    userFramework ||
    localCurrentFramework.currentFramework ||
    'react') as Framework

  const normalizedFramework = actualFramework.toLowerCase()

  // Find the framework's code blocks
  const frameworkBlocks = codeBlocksByFramework[normalizedFramework]
  const frameworkPanel = panelsByFramework[normalizedFramework]

  if (!frameworkBlocks || frameworkBlocks.length === 0 || !frameworkPanel) {
    return null
  }

  if (frameworkBlocks.length === 1) {
    return <div className="framework-code-block">{frameworkPanel}</div>
  }

  const tabs = frameworkBlocks.map((block, index) => ({
    slug: `file-${index}`,
    name: block.title || 'Untitled',
  }))

  const childrenArray = React.Children.toArray(frameworkPanel)

  return (
    <div className="framework-code-block">
      <FileTabs id={`${id}-${normalizedFramework}`} tabs={tabs}>
        {childrenArray}
      </FileTabs>
    </div>
  )
}
