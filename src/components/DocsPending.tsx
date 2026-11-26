import { DocContainer } from '~/components/DocContainer'
import { Spinner } from '~/components/Spinner'

/**
 * Rendered by docs routes while their loader data is not yet available
 * (e.g. when a navigation commits before an in-flight preload resolves).
 */
export function DocsPending() {
  return (
    <DocContainer>
      <div className="flex w-full items-center justify-center py-24">
        <Spinner />
      </div>
    </DocContainer>
  )
}
