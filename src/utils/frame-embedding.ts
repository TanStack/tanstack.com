export function isFrameEmbeddingAllowed(pathname: string) {
  return (
    pathname === '/partners-embed' ||
    pathname === '/sponsors-embed' ||
    pathname === '/stats/npm/embed'
  )
}

export const allowsFrameEmbedding = isFrameEmbeddingAllowed
