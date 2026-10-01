import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
const directory = fileURLToPath(new URL('./native/', import.meta.url))
mkdirSync(directory, { recursive: true })
execFileSync(
  'cc',
  [
    '-O2',
    '-Wall',
    '-Wextra',
    '-Werror',
    directory + 'folder-access.c',
    '-o',
    directory + 'folder-access',
  ],
  { stdio: 'inherit' },
)
