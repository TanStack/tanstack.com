import { useLocation } from '@remix-run/react'

export function Scarf({ id }: { id: string }) {
  const location = useLocation()

  return (
    <img
      key={location.key}
      alt="scarf analytics"
      referrerPolicy="no-referrer-when-downgrade"
      src={`https://static.scarf.sh/a.png?x-pxid=${id}&key=${location.key}`}
    />
  )
}
