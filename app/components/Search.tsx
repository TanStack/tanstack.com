import * as pkg from '@docsearch/react'
const { DocSearch } = pkg
import type { DocSearchProps } from '@docsearch/react'

export function Search(props: DocSearchProps) {
  return <DocSearch {...props} />
}
