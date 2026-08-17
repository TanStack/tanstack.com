type NotebookNavigator = Pick<
  Navigator,
  'maxTouchPoints' | 'platform' | 'userAgent'
>

export function shouldAutoRunNotebook(browser: NotebookNavigator) {
  return !(
    /iPad|iPhone|iPod/i.test(browser.userAgent) ||
    (browser.platform === 'MacIntel' && browser.maxTouchPoints > 1)
  )
}
