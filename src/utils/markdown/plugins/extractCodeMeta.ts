import type { Root } from 'hast'
import { visit } from 'unist-util-visit'

export function extractCodeMeta() {
  return (tree: Root) => {
    visit(tree, 'element', (node: any) => {
      if (node && node.tagName === 'pre') {
        const codeChild = Array.isArray(node.children)
          ? node.children[0]
          : undefined

        const metaString =
          (codeChild &&
            ((codeChild.data && codeChild.data.meta) ||
              (codeChild.properties && codeChild.properties.metastring))) ||
          undefined

        let filename: string | undefined = undefined
        let framework: string | undefined = undefined

        if (metaString && typeof metaString === 'string') {
          const marker = 'title="'
          const idx = metaString.indexOf(marker)

          if (idx !== -1) {
            const rest = metaString.slice(idx + marker.length)
            const end = rest.indexOf('"')

            if (end !== -1) {
              filename = rest.slice(0, end)
            }
          }

          // Extract framework attribute
          const frameworkMarker = 'framework="'
          const frameworkIdx = metaString.indexOf(frameworkMarker)

          if (frameworkIdx !== -1) {
            const rest = metaString.slice(frameworkIdx + frameworkMarker.length)
            const end = rest.indexOf('"')

            if (end !== -1) {
              framework = rest.slice(0, end).toLowerCase()
            }
          }
        }

        node.properties = {
          ...(node.properties || {}),
          'data-filename': filename,
          ...(filename ? { 'data-code-title': filename } : {}),
          ...(framework ? { 'data-framework': framework } : {}),
        }
      }
    })
  }
}
