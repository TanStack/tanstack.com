import { useSelector } from '@tanstack/react-store'
import { useEffect, useRef } from 'react'
import { gameStore } from '../hooks/useGameStore'
import { useProgression } from './GameMachineProvider'

/**
 * Hook that syncs game store state with the progression state machine.
 * This bridge allows the progression machine to track badge state while
 * the game store remains the source of truth for game logic.
 */
export function useProgressionSync() {
  const {
    discoverLibrary,
    discoverPartner,
    discoverShowcase,
    discoverCorner,
    completeUpgrade,
    shipDestroyed,
    respawn,
    startGame,
  } = useProgression()

  // Track previous values to detect changes
  const prevDiscoveredRef = useRef<Set<string>>(new Set())
  const prevPhaseRef = useRef<string>('')

  // Get game store state
  const discoveredIslands = useSelector(gameStore, (s) => s.discoveredIslands)
  const phase = useSelector(gameStore, (s) => s.phase)
  const islands = useSelector(gameStore, (s) => s.islands)
  const expandedIslands = useSelector(gameStore, (s) => s.expandedIslands)
  const showcaseIslands = useSelector(gameStore, (s) => s.showcaseIslands)
  const cornerIslands = useSelector(gameStore, (s) => s.cornerIslands)

  // Sync discoveries
  useEffect(() => {
    const prevDiscovered = prevDiscoveredRef.current

    // Find newly discovered islands
    for (const id of discoveredIslands) {
      if (!prevDiscovered.has(id)) {
        // Determine island type and notify progression machine
        if (islands.some((i) => i.id === id)) {
          discoverLibrary()
        } else if (
          expandedIslands.some((i) => i.id === id && i.type === 'partner')
        ) {
          discoverPartner()
        } else if (showcaseIslands.some((i) => i.id === id)) {
          discoverShowcase()
        } else if (cornerIslands.some((i) => i.id === id)) {
          discoverCorner()
        }
      }
    }

    prevDiscoveredRef.current = new Set(discoveredIslands)
  }, [
    discoveredIslands,
    islands,
    expandedIslands,
    showcaseIslands,
    cornerIslands,
    discoverLibrary,
    discoverPartner,
    discoverShowcase,
    discoverCorner,
  ])

  // Sync phase changes
  useEffect(() => {
    const prevPhase = prevPhaseRef.current

    if (prevPhase !== phase) {
      if (phase === 'playing' && prevPhase === 'intro') {
        startGame()
      } else if (phase === 'playing' && prevPhase === 'upgrading') {
        completeUpgrade()
      } else if (phase === 'gameover') {
        shipDestroyed()
      } else if (phase === 'playing' && prevPhase === 'gameover') {
        respawn()
      }
    }

    prevPhaseRef.current = phase
  }, [phase, startGame, completeUpgrade, shipDestroyed, respawn])
}
