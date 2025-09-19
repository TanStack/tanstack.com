import type { FileClass } from './types'

export const twClasses: Record<FileClass, string> = {
  unchanged: 'text-gray-500',
  added: 'text-green-500 font-bold',
  modified: 'text-blue-500 italic',
  deleted: 'text-red-500 line-through',
  overwritten: 'text-red-700 underline',
}

export type FileClassAndInfo = {
  fileClass: FileClass
  originalFile?: string
  modifiedFile?: string
}

export const getFileClass = (
  file: string,
  tree: Record<string, string>,
  originalTree: Record<string, string>
): FileClassAndInfo => {
  if (tree[file] && !originalTree[file]) {
    return {
      fileClass: 'added',
      modifiedFile: tree[file],
    }
  }
  if (!tree[file] && originalTree[file]) {
    return {
      fileClass: 'deleted',
      originalFile: originalTree[file],
    }
  }
  if (tree[file] !== originalTree[file]) {
    return {
      fileClass: 'modified',
      originalFile: tree[file],
      modifiedFile: originalTree[file],
    }
  }
  return {
    fileClass: 'unchanged',
    originalFile: tree[file],
    modifiedFile: tree[file],
  }
}
