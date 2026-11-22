// Vite replaces this constant at build time. A production artifact cannot enable it through a request or runtime setting.
declare const __GUM_LOCAL_DEVELOPMENT__: boolean
export function localDevelopment() {
  return (
    typeof __GUM_LOCAL_DEVELOPMENT__ !== 'undefined' &&
    __GUM_LOCAL_DEVELOPMENT__
  )
}
