export const searchBoxParams = {
  index: {
    api_key: 'xqfn8QcuImADRGPIlhWTo9cT5UNiqPDj',
    endpoint: 'https://cloud.orama.run/v1/indexes/tanstack-dev-ur0ppd',
  },
  colorScheme: 'system' as 'light' | 'dark' | 'system',
  facetProperty: 'category',
  resultMap: {
    description: 'content',
    section: 'category',
  },

  themeConfig: {
    colors: {
      light: {},
      dark: {
        '--backdrop-background-color-primary': 'rgba(0, 0, 0, 0.7)',
      },
    },
  },
  searchParams: {
    threshold: 0,
  },
}

export const searchButtonParams = {
  colorScheme: 'system',
}
