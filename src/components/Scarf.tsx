import { useRouterState } from '@tanstack/react-router'
import { useMounted } from '~/hooks/useMounted'

export function Scarf({ id }: { id: string }) {
  const locationKey = useRouterState({ select: (s) => s.location.state.key })

  const mounted = useMounted()

  return mounted ? (
    <img
      key={locationKey}
      alt="scarf analytics"
      referrerPolicy="no-referrer-when-downgrade"
      src={`https://static.scarf.sh/a.png?x-pxid=${id}&key=${locationKey}`}
      className="pointer-events-none fixed bottom-0 left-0 h-full w-full opacity-0"
    />
  ) : null
}
