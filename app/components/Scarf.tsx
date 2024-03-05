import { useRouterState } from '@tanstack/react-router'

export function Scarf({ id }: { id: string }) {
  const locationKey = useRouterState({ select: (s) => s.location.state.key })

  return (
    <img
      key={locationKey}
      alt="scarf analytics"
      referrerPolicy="no-referrer-when-downgrade"
      src={`https://static.scarf.sh/a.png?x-pxid=${id}&key=${locationKey}`}
    />
  )
}
