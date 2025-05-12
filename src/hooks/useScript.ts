import * as React from 'react'

export function useScript(
  attrs: React.HTMLProps<HTMLScriptElement>,
  opts?: {
    delay?: number
  }
) {
  const attrsStringified = JSON.stringify(attrs)

  React.useEffect(() => {
    const addScript = () => {
      const script = document.createElement('script')
      Object.assign(script, attrs)
      document.body.appendChild(script)

      return () => {
        document.body.removeChild(script)
      }
    }

    if (opts?.delay) {
      let remove: ReturnType<typeof addScript> | undefined

      const timeout = setTimeout(() => {
        remove = addScript()
      }, opts.delay)

      return () => {
        clearTimeout(timeout)
        remove?.()
      }
    }

    return addScript()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attrsStringified])
}
