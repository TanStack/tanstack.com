import { useMemo, useState } from 'react'
import { FileText, Folder } from 'lucide-react'

import FileTree from './file-tree'

import type { FileTreeItem } from '~/forge/types'

import { getFileClass, twClasses } from '~/forge/file-classes'
import FileViewer from '~/forge/ui/file-viewer'

export default function FileNavigator({
  originalTree,
  projectFiles,
}: {
  originalTree: Record<string, string>
  projectFiles: Record<string, string>
}) {
  const [selectedFile, setSelectedFile] = useState<string | null>(
    './package.json'
  )

  const { originalFileContents, modifiedFileContents } = useMemo(() => {
    return {
      originalFileContents: originalTree[selectedFile || ''],
      modifiedFileContents: projectFiles[selectedFile || ''],
    }
  }, [originalTree, projectFiles, selectedFile])

  const fileTree = useMemo(() => {
    const treeData: Array<FileTreeItem> = []
    const allFileSet = Array.from(
      new Set([...Object.keys(projectFiles), ...Object.keys(originalTree)])
    ).sort()

    for (const file of allFileSet) {
      const strippedFile = file.replace('./', '')
      const parts = strippedFile.split('/')

      const fileInfo = getFileClass(file, projectFiles, originalTree)

      let currentLevel = treeData
      for (const [index, part] of parts.entries()) {
        const existingNode = currentLevel.find((node) => node.name === part)
        if (existingNode) {
          currentLevel = existingNode.children || []
        } else {
          const newNode: FileTreeItem = {
            id: parts.slice(0, index + 1).join('/'),
            name: part,
            fullPath: strippedFile,
            children: index < parts.length - 1 ? [] : undefined,
            icon:
              index < parts.length - 1
                ? () => <Folder className="w-4 h-4 mr-2" />
                : () => <FileText className="w-4 h-4 mr-2" />,
            onClick:
              index === parts.length - 1
                ? () => {
                    setSelectedFile(file)
                  }
                : undefined,
            className: twClasses[fileInfo.fileClass],
            ...fileInfo,
          }
          currentLevel.push(newNode)
          currentLevel = newNode.children!
        }
      }
    }
    return treeData
  }, [projectFiles, originalTree, selectedFile])

  return (
    <div className="bg-white dark:bg-black/50 rounded-lg p-2 sm:p-4">
      <div className="flex flex-row @container">
        <div className="w-1/3 @6xl:w-1/4 bg-gray-500/10 rounded-l-lg">
          <FileTree selectedFile={selectedFile} tree={fileTree} />
        </div>
        <div className="w-2/3 @6xl:w-3/4">
          {selectedFile && modifiedFileContents ? (
            <FileViewer
              filePath={selectedFile}
              originalFile={originalFileContents}
              modifiedFile={modifiedFileContents}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
