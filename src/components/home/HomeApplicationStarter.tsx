import { ApplicationStarter } from '~/components/ApplicationStarter'

export function HomeApplicationStarter() {
  return (
    <ApplicationStarter
      context="home"
      enableHotkeys
      primaryButtonColor="cyan"
      tone="cyan"
    />
  )
}
