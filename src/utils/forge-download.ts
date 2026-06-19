export function getForgeDownloadErrorResponse(error: unknown): {
  body: {
    details: string
    error: string
  }
  status: 404 | 500
} {
  const details = error instanceof Error ? error.message : String(error)

  if (isMissingForgeDownloadManifest(details)) {
    return {
      body: {
        details,
        error: 'Forge manifest not found.',
      },
      status: 404,
    }
  }

  return {
    body: {
      details,
      error: 'Failed to download Forge manifest.',
    },
    status: 500,
  }
}

function isMissingForgeDownloadManifest(details: string) {
  return (
    details === 'Forge has no manifest to download.' ||
    (details.includes('ENOENT') && details.includes('/manifests/'))
  )
}
