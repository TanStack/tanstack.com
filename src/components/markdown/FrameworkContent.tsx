import { useLocalCurrentFramework } from '../FrameworkSelect'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { useParams } from '@tanstack/react-router'
import { Tabs } from './Tabs'
import type { Framework } from '~/libraries/types'
import { Children, ReactNode } from 'react'

type CodeBlockMeta = {
  title: string
  code: string
  language: string
}

type FrameworkContentProps = {
  codeBlocksByFramework: Record<string, CodeBlockMeta[]>
  availableFrameworks: string[]
  /** Pre-rendered React children for each framework (from domToReact) */
  panelsByFramework: Record<string, ReactNode>
}

/**
 * Renders content for the currently selected framework.
 * - If no content for framework: shows nothing
 * - If 1 code block: shows just the code block (minimal style)
 * - If multiple code blocks: shows as file tabs
 * - If no code blocks but has content: shows the content directly
 */
export function FrameworkContent({
  codeBlocksByFramework,
  panelsByFramework,
}: FrameworkContentProps) {
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
  const frameworkBlocks = codeBlocksByFramework[normalizedFramework] || []
  const frameworkPanel = panelsByFramework[normalizedFramework]

  // If no panel content at all for this framework, show nothing
  if (!frameworkPanel) {
    return null
  }

  // If no code blocks, just render the content directly
  if (frameworkBlocks.length === 0) {
    return <div className="framework-content">{frameworkPanel}</div>
  }

  // If 1 code block, render minimal style
  if (frameworkBlocks.length === 1) {
    return <div className="framework-content">{frameworkPanel}</div>
  }

  // Multiple code blocks - show as file tabs
  const tabs = frameworkBlocks.map((block, index) => ({
    slug: `file-${index}`,
    name: block.title || 'Untitled',
  }))

  const childrenArray = Children.toArray(frameworkPanel)

  return (
    <div className="framework-content">
      <Tabs tabs={tabs}>{childrenArray}</Tabs>
    </div>
  )
}
