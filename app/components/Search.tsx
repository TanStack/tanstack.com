import { default as pkg } from '@docsearch/react'
console.log(pkg)
import type { DocSearchProps } from '@docsearch/react'

const { DocSearch } = pkg

export function Search(props: DocSearchProps) {
  return <DocSearch {...props} />
}
