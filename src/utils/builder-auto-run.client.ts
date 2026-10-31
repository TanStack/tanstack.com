type BuilderNavigator = Pick<
  Navigator,
  'maxTouchPoints' | 'platform' | 'userAgent'
>

export function shouldAutoRunBuilder(browser: BuilderNavigator) {
  return !(
    /iPad|iPhone|iPod/i.test(browser.userAgent) ||
    (browser.platform === 'MacIntel' && browser.maxTouchPoints > 1)
  )
}
