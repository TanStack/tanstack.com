import { useState } from 'react'
import { Boxes } from 'lucide-react'
import './package-browser.css'

export function packageName(name: string) {
  const parts = name.split('/')
  return {
    title: parts.at(-1) || name,
    owner: parts.length > 1 ? parts.slice(0, -1).join('/') : '',
  }
}
export function PackageIdentity({
  iconUrl,
}: {
  name: string
  iconUrl?: string
}) {
  const [failedUrl, setFailedUrl] = useState<string>()
  return (
    <span className="package-identity" aria-hidden>
      {iconUrl && failedUrl !== iconUrl ? (
        <img
          src={iconUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(iconUrl)}
        />
      ) : (
        <Boxes size={24} strokeWidth={1.7} />
      )}
    </span>
  )
}
