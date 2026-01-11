export const seo = ({
  title,
  description,
  keywords,
  image,
  noindex,
}: {
  title: string
  description?: string
  image?: string
  keywords?: string
  noindex?: boolean
}) => {
  const tags = [
    { title },
    { name: 'description', content: description },
    { name: 'keywords', content: keywords },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:creator', content: '@tannerlinsley' },
    { name: 'twitter:site', content: '@tannerlinsley' },
    { property: 'og:type', content: 'website' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    ...(image
      ? [
          { name: 'twitter:image', content: image },
          { name: 'twitter:card', content: 'summary_large_image' },
          { property: 'og:image', content: image },
        ]
      : []),
    ...(noindex ? [{ name: 'robots', content: 'noindex, nofollow' }] : []),
  ]

  return tags
}
