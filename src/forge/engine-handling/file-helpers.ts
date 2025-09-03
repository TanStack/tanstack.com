import { basename } from 'node:path'

import { CONFIG_FILE } from '@tanstack/cta-engine'

export function cleanUpFiles(
  files: Record<string, string>,
  targetDir?: string
) {
  return Object.keys(files).reduce<Record<string, string>>((acc, file) => {
    if (basename(file) !== CONFIG_FILE) {
      acc[targetDir ? file.replace(targetDir, '.') : file] = files[file]
    }
    return acc
  }, {})
}

export function cleanUpFileArray(files: Array<string>, targetDir?: string) {
  return files.reduce<Array<string>>((acc, file) => {
    if (basename(file) !== CONFIG_FILE) {
      acc.push(targetDir ? file.replace(targetDir, '.') : file)
    }
    return acc
  }, [])
}
