type DocsNotFoundError = Error & {
  data: { message: string }
  isDocsNotFound: true
}

export function createDocsNotFoundError(message = 'No doc was found here!') {
  const error = new Error(message) as DocsNotFoundError

  error.name = 'DocsNotFoundError'
  error.data = { message }
  error.isDocsNotFound = true

  return error
}

export function isDocsNotFoundError(
  error: unknown,
): error is DocsNotFoundError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isDocsNotFound' in error &&
    error.isDocsNotFound === true
  )
}
