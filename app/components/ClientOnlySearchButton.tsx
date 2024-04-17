import * as React from 'react'
// @ts-expect-error
import { SearchButton } from '@orama/searchbox'
import { Suspense } from 'react'
import { ImSpinner2 } from 'react-icons/im'

let defaultMounted = false

export function ClientOnlySearchButton(props: any) {
  const [mounted, setMounted] = React.useState(defaultMounted)

  React.useEffect(() => {
    defaultMounted = true
    setMounted(defaultMounted)
  }, [])

  return (
    <Suspense fallback={null}>
      {mounted ? (
        <SearchButton {...props} />
      ) : (
        <div className="bg-gray-500/5 h-[41px] rounded-md flex items-center pl-4">
          <ImSpinner2 className="animate-spin" />
        </div>
      )}
    </Suspense>
  )
}
