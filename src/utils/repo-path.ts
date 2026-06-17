export const MAX_REPO_PATH_LENGTH = 512

const REPO_PATH_SEGMENT_PATTERN = /^[a-zA-Z0-9._$-]+$/

export function isValidRepoPath(path: string) {
  if (path === '') {
    return true
  }

  if (path.length > MAX_REPO_PATH_LENGTH) {
    return false
  }

  if (
    path.startsWith('/') ||
    path.endsWith('/') ||
    path.includes('//') ||
    path.includes('..')
  ) {
    return false
  }

  return path.split('/').every((segment) => {
    return REPO_PATH_SEGMENT_PATTERN.test(segment)
  })
}
