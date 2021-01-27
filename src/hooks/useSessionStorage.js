import React from 'react'

export default function useSessionStorage(key, defaultValue = '') {
  const [state, setState] = React.useState(() => {
    if (typeof document !== 'undefined') {
      const data = sessionStorage.getItem(key)
      if (data) {
        try {
          return JSON.parse(data)
        } catch {
          //
        }
      }
      return defaultValue
    }
    return defaultValue
  })

  React.useEffect(() => {
    sessionStorage.setItem(key, JSON.stringify(state))
  }, [state])

  return [state, setState]
}
