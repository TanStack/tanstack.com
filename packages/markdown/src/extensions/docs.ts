import type { ComponentNode, MarkdownExtension } from '../types.js'
import { calloutsExtension } from './callouts.js'
import { commentComponentsExtension } from './comment-components.js'
import { transformFrameworkComponent } from './framework.js'
import {
  headingCollectionExtension,
  type HeadingCollectionOptions,
} from './headings.js'
import { transformTabsComponent } from './tabs.js'

export interface DocsMarkdownOptions {
  collectHeadings?: boolean | HeadingCollectionOptions
}

export function docsMarkdownExtensions(
  options: DocsMarkdownOptions = {},
): MarkdownExtension[] {
  const extensions = [
    calloutsExtension(),
    commentComponentsExtension({
      transformComponent: transformDocsComponent,
    }),
  ]

  if (options.collectHeadings !== false) {
    extensions.push(
      headingCollectionExtension(
        typeof options.collectHeadings === 'object'
          ? options.collectHeadings
          : {},
      ),
    )
  }

  return extensions
}

export function transformDocsComponent(node: ComponentNode): ComponentNode {
  const name = node.name.toLowerCase()
  if (name === 'tabs') return transformTabsComponent(node)
  if (name === 'framework') return transformFrameworkComponent(node)
  return node
}
