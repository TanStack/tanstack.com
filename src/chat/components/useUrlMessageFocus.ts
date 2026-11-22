import { useLayoutEffect, useState } from 'react'
import {
  createUrlMessageFocusOwner,
  type UrlMessageFocus,
} from './message-focus'

/** Mount this before fetching history so loading does not create a fresh focus
 * claim after the person has already moved to another control.
 */
export function useUrlMessageFocus(
  messageId: string | undefined,
  visible: boolean,
) {
  const [owner] = useState(() => createUrlMessageFocusOwner())
  const [selection, setSelection] = useState<UrlMessageFocus>()
  useLayoutEffect(() => {
    setSelection(owner.setup(messageId, visible))
    return () => owner.cleanup()
  }, [owner, messageId, visible])
  return selection?.messageId === messageId ? selection : undefined
}
