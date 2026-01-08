import { useEffect, useState } from 'react'
import { useGameStore } from '../hooks/useGameStore'
import { getLibraryColor } from '../utils/colors'

// Minimap dimensions - diamond shape
const MINIMAP_WIDTH = 160
const MINIMAP_HEIGHT = 95 // Shorter to create isometric diamond look

export function Minimap() {
  const { phase, islands, expandedIslands, discoveredIslands } = useGameStore()
  const [boatState, setBoatState] = useState({
    x: 0,
    z: 0,
    rotation: 0,
    worldBoundary: 85,
  })

  useEffect(() => {
    if (phase !== 'playing') return

    const interval = setInterval(() => {
      const { boatPosition, boatRotation, worldBoundary } =
        useGameStore.getState()
      setBoatState({
        x: boatPosition[0],
        z: boatPosition[2],
        rotation: boatRotation,
        worldBoundary,
      })
    }, 50)

    return () => clearInterval(interval)
  }, [phase])

  if (phase !== 'playing') return null

  // All islands (core + expanded)
  const allIslands = [...islands, ...expandedIslands]

  // Convert world position to isometric minimap position
  // Camera is at (+X, +Y, +Z) looking toward origin, so:
  // - Moving +X in world = moving right on screen
  // - Moving +Z in world = moving down-left on screen
  // For isometric: we rotate 45 degrees and squash vertically
  const worldToMinimap = (worldX: number, worldZ: number) => {
    // Normalize to -1 to 1 based on current world boundary
    const nx = worldX / boatState.worldBoundary
    const nz = worldZ / boatState.worldBoundary

    // Isometric projection (rotate 45 degrees)
    // Screen X = worldX - worldZ (diagonal)
    // Screen Y = (worldX + worldZ) / 2 (compressed depth)
    const isoX = (nx - nz) * 0.5
    const isoY = (nx + nz) * 0.5

    // Map to minimap coordinates (center is middle of minimap)
    return {
      x: MINIMAP_WIDTH / 2 + isoX * (MINIMAP_WIDTH / 2) * 0.9,
      y: MINIMAP_HEIGHT / 2 + isoY * (MINIMAP_HEIGHT / 2) * 0.9,
    }
  }

  const boatPos = worldToMinimap(boatState.x, boatState.z)

  // Arrow rotation: convert world rotation to screen rotation
  // Boat rotation 0 = facing +Z = down-left in isometric view
  const arrowRotation = -boatState.rotation * (180 / Math.PI) + 225

  const discoveredIslandsList = allIslands.filter((island) =>
    discoveredIslands.has(island.id),
  )

  // Diamond path for background
  const diamondPath = `M ${MINIMAP_WIDTH / 2} 2 L ${MINIMAP_WIDTH - 2} ${MINIMAP_HEIGHT / 2} L ${MINIMAP_WIDTH / 2} ${MINIMAP_HEIGHT - 2} L 2 ${MINIMAP_HEIGHT / 2} Z`

  return (
    <div
      className="absolute bottom-4 left-4 z-10 pointer-events-none"
      style={{
        width: MINIMAP_WIDTH,
        height: MINIMAP_HEIGHT,
      }}
    >
      <svg
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        style={{ overflow: 'visible' }}
      >
        {/* Background diamond */}
        <path
          d={diamondPath}
          fill="rgba(0, 0, 0, 0.5)"
          stroke="rgba(255, 255, 255, 0.3)"
          strokeWidth={1}
        />

        {/* Clip content to diamond */}
        <defs>
          <clipPath id="diamond-clip">
            <path d={diamondPath} />
          </clipPath>
        </defs>

        <g clipPath="url(#diamond-clip)">
          {/* Discovered islands */}
          {discoveredIslandsList.map((island) => {
            const pos = worldToMinimap(island.position[0], island.position[2])
            const color =
              island.type === 'library' && island.library
                ? getLibraryColor(island.library.id)
                : island.type === 'partner'
                  ? '#f59e0b'
                  : '#8b5cf6'
            const size = 1.5 + island.scale * 1

            return (
              <circle
                key={island.id}
                cx={pos.x}
                cy={pos.y}
                r={size}
                fill={color}
                opacity={0.9}
              />
            )
          })}

          {/* Boat arrow */}
          <g
            transform={`translate(${boatPos.x}, ${boatPos.y}) rotate(${arrowRotation})`}
          >
            <polygon
              points="0,-4 2.5,3 0,1.5 -2.5,3"
              fill="white"
              stroke="rgba(0,0,0,0.5)"
              strokeWidth={0.5}
            />
          </g>
        </g>
      </svg>
    </div>
  )
}
