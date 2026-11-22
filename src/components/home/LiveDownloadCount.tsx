import NumberFlow, { type Format } from '@number-flow/react'
import { useEffect, useState } from 'react'

export function LiveDownloadCount({
  value,
  ratePerDay,
  fetchedAt,
  format,
}: {
  value: number
  ratePerDay: number
  fetchedAt: number
  format?: Format
}) {
  const [sampledAt, setSampledAt] = useState(0)
  const isLive = ratePerDay > 0 && fetchedAt > 0

  useEffect(() => {
    if (!isLive) return

    const tick = () => {
      if (!document.hidden) {
        setSampledAt(Date.now())
      }
    }
    const timer = window.setInterval(tick, 1000)
    document.addEventListener('visibilitychange', tick)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [isLive])

  const elapsedSeconds = Math.max(0, Math.floor((sampledAt - fetchedAt) / 1000))

  return (
    <NumberFlow
      value={Math.round(value + (ratePerDay * elapsedSeconds) / 86_400)}
      locales="en-US"
      format={format}
      transformTiming={{ duration: 450, easing: 'ease-out' }}
    />
  )
}
