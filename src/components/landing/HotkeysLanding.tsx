import * as React from 'react'
import { ClientOnly } from '@tanstack/react-router'
import { Footer } from '~/components/Footer'
import { LibraryHero } from '~/components/LibraryHero'
import { PartnersSection } from '~/components/PartnersSection'
import { MaintainersSection } from '~/components/MaintainersSection'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { BottomCTA } from '~/components/BottomCTA'
import { hotkeysProject } from '~/libraries/hotkeys'
import { getLibrary } from '~/libraries'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import LandingPageGad from '~/components/LandingPageGad'
import { LibraryPageContainer } from '~/components/LibraryPageContainer'
import { LibraryStatsSection } from '~/components/LibraryStatsSection'
import { FeatureGridSection } from '~/components/FeatureGridSection'

const library = getLibrary('hotkeys')

const LazyHotkeysShortcutBinding = React.lazy(() =>
  import('~/components/landing/HotkeysShortcut.client').then((m) => ({
    default: m.HotkeysShortcutBinding,
  })),
)

export default function HotkeysLanding() {
  return (
    <LibraryPageContainer>
      <ClientOnly>
        <React.Suspense fallback={null}>
          <LazyHotkeysShortcutBinding />
        </React.Suspense>
      </ClientOnly>
      <LibraryHero
        project={hotkeysProject}
        cta={{
          linkProps: {
            to: '/$libraryId/$version/docs',
            params: { libraryId: library.id, version: 'latest' },
          },
          label: (
            <>
              Get Started <kbd className="ml-1">Ctrl/Cmd+Enter</kbd>
            </>
          ),
          className: 'bg-rose-600 border-rose-600 hover:bg-rose-700 text-white',
        }}
      />

      <LibraryStatsSection library={library} />

      <LibraryFeatureHighlights
        featureHighlights={hotkeysProject.featureHighlights}
      />

      <FeatureGridSection
        title="Type-Safe & Feature Rich"
        description="TanStack Hotkeys provides a complete keyboard interaction toolkit with type safety and cross-platform support built in."
        items={[
          'Type-Safe Hotkey Strings',
          'Cross-Platform Mod Modifier',
          'Keyboard Sequences',
          'Hotkey Recording',
          'Key Hold Detection',
          'Document or Element Scoping',
          'Conflict Warnings',
          'Input Element Filtering',
          'Display Formatting Utilities',
          'Singleton HotkeyManager',
          'Framework Agnostic Core',
          'Awesome Devtools!',
          'Automatic Cleanup',
          'Cheat Sheet Utilities',
          'Lightweight & Tree-Shakeable',
        ]}
        gridClassName="grid grid-flow-row grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-10 gap-y-4 mx-auto"
      />

      <MaintainersSection libraryId="hotkeys" />
      <PartnersSection libraryId="hotkeys" />
      <LazySponsorSection />
      <LandingPageGad />

      <BottomCTA
        linkProps={{
          to: '/$libraryId/$version/docs',
          params: { libraryId: library.id },
        }}
        label="Get Started!"
        className="bg-rose-600 border-rose-600 hover:bg-rose-700 hover:border-rose-700 text-white"
      />
      <Footer />
    </LibraryPageContainer>
  )
}
