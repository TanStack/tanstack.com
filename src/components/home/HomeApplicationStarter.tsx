import * as React from 'react'
import { Hydrate } from '@tanstack/react-start'
import { idle, visible } from '@tanstack/react-start/hydration'

import { ApplicationStarter } from '~/components/ApplicationStarter'
import { HomeApplicationStarterFallback } from './HomeSectionFallbacks'

const headlineStorageKey = 'tanstack-home-starter-headline-index'
const headlines = [
  'Describe what you want to build.',
  'Prompt your app idea.',
  'Start with one prompt.',
  'Tell Stack Builder what you’re making.',
  'Your app starts with a prompt.',
] as const

export function HomeApplicationStarter() {
  return (
    <Hydrate
      when={visible({ rootMargin: '180px 0px' })}
      prefetch={idle({ timeout: 3500 })}
      fallback={<HomeApplicationStarterFallback />}
    >
      <RotatingHomeApplicationStarter />
    </Hydrate>
  )
}

function RotatingHomeApplicationStarter() {
  const [headlineIndex, setHeadlineIndex] = React.useState(0)

  React.useEffect(() => {
    const storedIndex = Number.parseInt(
      window.localStorage.getItem(headlineStorageKey) ?? '',
      10,
    )
    const currentIndex =
      Number.isInteger(storedIndex) &&
      storedIndex >= 0 &&
      storedIndex < headlines.length
        ? storedIndex
        : 0

    setHeadlineIndex(currentIndex)
    window.localStorage.setItem(
      headlineStorageKey,
      String((currentIndex + 1) % headlines.length),
    )
  }, [])

  return (
    <ApplicationStarter
      context="home"
      enableHotkeys
      showPromptPreview={false}
      title={headlines[headlineIndex]}
      tone="cyan"
    />
  )
}
