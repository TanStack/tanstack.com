import type { RegisterSearchButtonProps, RegisterSearchBoxProps } from '@orama/searchbox'
import { OramaClient } from '@oramacloud/client'
import '@orama/searchbox/dist/index.css'

const oramaInstance = new OramaClient({
  // The search endpoint for the Orama index
  endpoint: 'https://cloud.orama.run/v1/indexes/tanstack-dev-ur0ppd',
  // The public API key for performing search. This is commit-safe.
  api_key: 'xqfn8QcuImADRGPIlhWTo9cT5UNiqPDj',
})

export const searchBoxParams: RegisterSearchBoxProps ={
  oramaInstance,
  colorScheme: 'dark',
  backdrop: false,
  facetProperty: 'category',
  resultsMap: {
    description: 'content',
  },
  // The public API key for summary generation. This is commit-safe.
  summaryGeneration: 'i75cz4r3-gNgyzkFb5xafcnFPWbxGMhW'
}

export const searchButtonParams: RegisterSearchButtonProps = {
  colorScheme: 'dark',
  fullWidth: true,
  themeConfig: {
    light: {},
    dark: {
      '--backdrop-bg-color': '#a8b1ff0a'
    }
  }
}
