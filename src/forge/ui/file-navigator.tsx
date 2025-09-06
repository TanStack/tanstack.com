import { useMemo, useState } from 'react'
import { FileText, Folder, ChevronLeft, ChevronRight } from 'lucide-react'

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
  const [isTreeCollapsed, setIsTreeCollapsed] = useState(true)

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
    <div className="bg-slate-900/30 backdrop-blur-sm border border-slate-800 rounded-2xl p-2 sm:p-4 h-full">
      <div className="flex flex-row @container h-full">
        {/* File Tree Panel */}
        <div
          className={`${
            isTreeCollapsed ? 'w-0' : 'w-1/3 @6xl:w-1/4'
          } transition-all duration-300 overflow-hidden bg-slate-800/50 rounded-l-xl border-r border-slate-700`}
        >
          {!isTreeCollapsed && (
            <div className="h-full p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-300">Files</h3>
                <button
                  onClick={() => setIsTreeCollapsed(true)}
                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                  title="Collapse file tree"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
              <div className="h-[calc(100%-2.5rem)] overflow-y-auto">
                <FileTree selectedFile={selectedFile} tree={fileTree} />
              </div>
            </div>
          )}
        </div>

        {/* File Viewer Panel */}
        <div
          className={`${
            isTreeCollapsed ? 'w-full' : 'w-2/3 @6xl:w-3/4'
          } transition-all duration-300 relative`}
        >
          {/* Toggle Button - Much More Prominent */}
          {isTreeCollapsed && (
            <div className="absolute top-4 left-4 z-10">
              <button
                onClick={() => setIsTreeCollapsed(false)}
                className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-2xl shadow-blue-500/25 border border-blue-500/20"
                title="Show file explorer"
              >
                <ChevronRight className="w-5 h-5" />
                <span className="text-sm">Show Files</span>
              </button>
              {/* Pulsing indicator for first-time users */}
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
            </div>
          )}

          {selectedFile && modifiedFileContents ? (
            <FileViewer
              filePath={selectedFile}
              originalFile={originalFileContents}
              modifiedFile={modifiedFileContents}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500">
              <div className="text-center space-y-6">
                <div className="space-y-3">
                  <FileText className="w-16 h-16 mx-auto opacity-50" />
                  <h3 className="text-lg font-medium text-slate-400">
                    No file selected
                  </h3>
                  <p className="text-slate-500">
                    Browse your project files to get started
                  </p>
                </div>

                {isTreeCollapsed && (
                  <button
                    onClick={() => setIsTreeCollapsed(false)}
                    className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-2xl shadow-blue-500/25"
                  >
                    <Folder className="w-5 h-5" />
                    Browse Files
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
