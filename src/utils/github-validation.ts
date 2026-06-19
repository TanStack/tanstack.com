/**
 * Validate a repository name before using it in GitHub side effects.
 */
export function validateRepoName(name: string): {
  valid: boolean
  error?: string
} {
  if (!name) {
    return { valid: false, error: 'Repository name is required' }
  }

  if (name.length > 100) {
    return {
      valid: false,
      error: 'Repository name must be 100 characters or less',
    }
  }

  const validPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/
  if (!validPattern.test(name)) {
    return {
      valid: false,
      error:
        'Repository name can only contain letters, numbers, hyphens, underscores, and periods',
    }
  }

  const reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1']
  if (reserved.includes(name.toUpperCase())) {
    return { valid: false, error: 'This name is reserved' }
  }

  return { valid: true }
}

/**
 * Validate a Git branch name before using it in GitHub side effects.
 */
export function validateBranchName(name: string): {
  valid: boolean
  error?: string
} {
  if (!name) {
    return { valid: false, error: 'Branch name is required' }
  }

  if (name.length > 255) {
    return { valid: false, error: 'Branch name must be 255 characters or less' }
  }

  if (name !== name.trim()) {
    return {
      valid: false,
      error: 'Branch name cannot contain leading or trailing whitespace',
    }
  }

  if (name.startsWith('-')) {
    return { valid: false, error: 'Branch name cannot start with a hyphen' }
  }

  if (name.startsWith('/') || name.endsWith('/')) {
    return {
      valid: false,
      error: 'Branch name cannot start or end with a slash',
    }
  }

  if (name.endsWith('.')) {
    return { valid: false, error: 'Branch name cannot end with a period' }
  }

  if (name.includes('//')) {
    return { valid: false, error: 'Branch name cannot contain empty segments' }
  }

  if (name.includes('..')) {
    return {
      valid: false,
      error: 'Branch name cannot contain two periods in a row',
    }
  }

  if (name === '@' || name.includes('@{')) {
    return {
      valid: false,
      error: 'Branch name contains a reserved Git sequence',
    }
  }

  for (const char of name) {
    const code = char.charCodeAt(0)

    if (
      code <= 32 ||
      code === 127 ||
      char === '~' ||
      char === '^' ||
      char === ':' ||
      char === '?' ||
      char === '*' ||
      char === '[' ||
      char === '\\'
    ) {
      return {
        valid: false,
        error: 'Branch name contains a character Git does not allow',
      }
    }
  }

  for (const segment of name.split('/')) {
    if (segment.startsWith('.')) {
      return {
        valid: false,
        error: 'Branch name segments cannot start with a period',
      }
    }

    if (segment.endsWith('.lock')) {
      return {
        valid: false,
        error: 'Branch name segments cannot end with .lock',
      }
    }
  }

  return { valid: true }
}
