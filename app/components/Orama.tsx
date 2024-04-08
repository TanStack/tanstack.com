import { OramaClient } from '@oramacloud/client'
import { RegisterSearchBox, RegisterSearchButton } from '@orama/searchbox'
import '@orama/searchbox/dist/index.css'

const oramaInstance = new OramaClient({
  endpoint: 'https://cloud.orama.run/v1/indexes/tanstack-dev-ur0ppd',
  api_key: 'xqfn8QcuImADRGPIlhWTo9cT5UNiqPDj',
})

RegisterSearchBox({
  oramaInstance,
  colorScheme: 'dark',
  backdrop: true,
  facetProperty: 'category',
  resultsMap: {
    description: 'content',
  },
  summaryGeneration: 'i75cz4r3-gNgyzkFb5xafcnFPWbxGMhW',
})

RegisterSearchButton({
  colorScheme: 'dark',
})
