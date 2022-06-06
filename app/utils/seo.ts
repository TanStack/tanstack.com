export function seo({
  title,
  description,
  keywords,
  image,
}: {
  title: string
  description?: string
  image?: string
  keywords?: string
}) {
  const tags = {
    title,
    description,
    keywords,
    'twitter:title': title,
    'twitter:description': description,
    'twitter:creator': '@tannerlinsley',
    'twitter:site': '@tannerlinsley',
    ...(image
      ? {
          'twitter:image': image,
          'twitter:card': 'summary_large_image',
        }
      : {}),
    'og:type': 'website',
    'og:title': title,
    'og:description': description,
    'og:image': image,
  } as const

  Object.keys(tags).forEach((key) => {
    const _tags = tags as any

    if (!_tags[key]) {
      delete _tags[key]
    }
  })

  return tags as Record<string, string>
}
