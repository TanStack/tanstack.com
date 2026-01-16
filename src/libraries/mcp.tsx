import { Bot, FileSearch, Library } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { mcp } from './libraries'

const textStyles = 'text-black dark:text-gray-100'

export const mcpProject = {
  ...mcp,
  featureHighlights: [
    {
      title: 'Search Documentation',
      icon: <FileSearch className={twMerge('scale-125', textStyles)} />,
      description: (
        <div>
          Instantly search across all TanStack documentation using Algolia.{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            Filter by library or framework
          </span>{' '}
          to find exactly what you need.
        </div>
      ),
    },
    {
      title: 'Fetch Doc Pages',
      icon: <Bot className={twMerge('scale-125', textStyles)} />,
      description: (
        <div>
          Retrieve full documentation pages with markdown content.{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            Perfect for AI assistants
          </span>{' '}
          that need deep context about TanStack libraries.
        </div>
      ),
    },
    {
      title: 'Explore Libraries',
      icon: <Library className={twMerge('scale-125', textStyles)} />,
      description: (
        <div>
          List all TanStack libraries with metadata including{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            supported frameworks, versions, and documentation links
          </span>
          .
        </div>
      ),
    },
  ],
}
