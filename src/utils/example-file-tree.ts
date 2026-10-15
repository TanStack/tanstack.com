import type { FileExplorerNode } from '../components/FileExplorer'

export function createExampleFileTree(paths: Array<string>) {
  const root: Array<FileExplorerNode> = []

  for (const path of paths) {
    const segments = path.split('/').filter(Boolean)
    let children = root

    for (const [index, name] of segments.entries()) {
      const nodePath = `/${segments.slice(0, index + 1).join('/')}`
      const last = index === segments.length - 1
      let node = children.find((candidate) => candidate.path === nodePath)

      if (!node) {
        node = {
          children: last ? undefined : [],
          depth: index,
          name,
          path: nodePath,
          type: last ? 'file' : 'dir',
        }
        children.push(node)
      }

      if (node.children) children = node.children
    }
  }

  return root
}
