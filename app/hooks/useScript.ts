import * as React from 'react'

export function useScript(attrs: React.HTMLProps<HTMLScriptElement>) {
  const attrsStringified = JSON.stringify(attrs)

  React.useEffect(() => {
    const script = document.createElement('script')
    Object.assign(script, attrs)
    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attrsStringified])
}
