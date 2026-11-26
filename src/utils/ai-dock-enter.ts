type EnterKeyEvent = {
  key: string
  nativeEvent: Pick<KeyboardEvent, 'isComposing' | 'keyCode'>
  preventDefault: () => void
}

export function submitOnEnter(event: EnterKeyEvent, submit: () => void) {
  if (
    event.key !== 'Enter' ||
    event.nativeEvent.isComposing ||
    // Safari can fire compositionend before this keydown, so isComposing is
    // already false. keyCode is deprecated, but it is still 229 here.
    event.nativeEvent.keyCode === 229
  ) {
    return
  }
  event.preventDefault()
  submit()
}
