import { visit } from 'unist-util-visit'

export function extractCodeMeta() {
  return (tree) => {
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
        }

        node.properties = {
          ...(node.properties || {}),
          'data-filename': filename,
          ...(filename ? { 'data-code-title': filename } : {}),
        }
      }
    })
  }
}
