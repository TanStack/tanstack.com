import { useRef, useState, Suspense, useMemo } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { COLORS } from '../utils/colors'
import { useGameStore } from '../hooks/useGameStore'
import { partners } from '~/utils/partners'

// Get partner logo URL by ID (use dark version for light background)
function getPartnerLogo(partnerId: string): string | null {
  const partner = partners.find((p) => p.id === partnerId)
  if (!partner) return null

  const image = partner.image
  if ('light' in image && 'dark' in image) {
    // Use light version (dark logo) for light background
    return image.light
  }
  if ('src' in image) {
    return image.src
  }
  return null
}

// Rectangle border that fills like a doughnut chart
function DiscoveryBorder({
  width,
  height,
  islandId,
}: {
  width: number
  height: number
  islandId: string
}) {
  const groupRef = useRef<THREE.Group>(null)
  const topRef = useRef<THREE.Mesh>(null)
  const rightRef = useRef<THREE.Mesh>(null)
  const bottomRef = useRef<THREE.Mesh>(null)
  const leftRef = useRef<THREE.Mesh>(null)

  const thickness = 0.06
  const depth = 0.02
  const perimeter = 2 * width + 2 * height

  useFrame(() => {
    const { discoveryProgress, nearbyIsland, discoveredIslands } =
      useGameStore.getState()

    // Hide if already discovered
    if (groupRef.current) {
      groupRef.current.visible = !discoveredIslands.has(islandId)
    }

    const isActive = nearbyIsland?.id === islandId
    const progress = isActive ? discoveryProgress : 0

    const topEnd = width / perimeter
    const rightEnd = topEnd + height / perimeter
    const bottomEnd = rightEnd + width / perimeter

    if (topRef.current) {
      const topProgress = Math.min(1, progress / topEnd)
      topRef.current.scale.x = Math.max(0.001, topProgress)
      topRef.current.position.x = -width / 2 + (width * topProgress) / 2
    }

    if (rightRef.current) {
      const rightProgress =
        progress > topEnd
          ? Math.min(1, (progress - topEnd) / (rightEnd - topEnd))
          : 0
      rightRef.current.scale.y = Math.max(0.001, rightProgress)
      rightRef.current.position.y = height / 2 - (height * rightProgress) / 2
    }

    if (bottomRef.current) {
      const bottomProgress =
        progress > rightEnd
          ? Math.min(1, (progress - rightEnd) / (bottomEnd - rightEnd))
          : 0
      bottomRef.current.scale.x = Math.max(0.001, bottomProgress)
      bottomRef.current.position.x = width / 2 - (width * bottomProgress) / 2
    }

    if (leftRef.current) {
      const leftProgress =
        progress > bottomEnd
          ? Math.min(1, (progress - bottomEnd) / (1 - bottomEnd))
          : 0
      leftRef.current.scale.y = Math.max(0.001, leftProgress)
      leftRef.current.position.y = -height / 2 + (height * leftProgress) / 2
    }
  })

  return (
    <group ref={groupRef} position={[0, 0, 0.02]}>
      <mesh
        ref={topRef}
        position={[-width / 2, height / 2 + thickness / 2, 0]}
        scale={[0.001, 1, 1]}
      >
        <boxGeometry args={[width, thickness, depth]} />
        <meshStandardMaterial
          color="#FFFFFF"
          emissive="#FFFFFF"
          emissiveIntensity={0.5}
        />
      </mesh>
      <mesh
        ref={rightRef}
        position={[width / 2 + thickness / 2, height / 2, 0]}
        scale={[1, 0.001, 1]}
      >
        <boxGeometry args={[thickness, height, depth]} />
        <meshStandardMaterial
          color="#FFFFFF"
          emissive="#FFFFFF"
          emissiveIntensity={0.5}
        />
      </mesh>
      <mesh
        ref={bottomRef}
        position={[width / 2, -height / 2 - thickness / 2, 0]}
        scale={[0.001, 1, 1]}
      >
        <boxGeometry args={[width, thickness, depth]} />
        <meshStandardMaterial
          color="#FFFFFF"
          emissive="#FFFFFF"
          emissiveIntensity={0.5}
        />
      </mesh>
      <mesh
        ref={leftRef}
        position={[-width / 2 - thickness / 2, -height / 2, 0]}
        scale={[1, 0.001, 1]}
      >
        <boxGeometry args={[thickness, height, depth]} />
        <meshStandardMaterial
          color="#FFFFFF"
          emissive="#FFFFFF"
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  )
}

// Green checkmark for discovered islands
function DiscoveredCheckmark({ islandId }: { islandId: string }) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame(() => {
    if (!groupRef.current) return
    const { discoveredIslands } = useGameStore.getState()
    groupRef.current.visible = discoveredIslands.has(islandId)
  })

  return (
    <group ref={groupRef} position={[1.1, 0.35, 0.06]} visible={false}>
      <mesh>
        <circleGeometry args={[0.18, 16]} />
        <meshStandardMaterial color="#22c55e" />
      </mesh>
      <group position={[0, 0, 0.02]}>
        <mesh position={[-0.04, -0.02, 0]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.06, 0.02, 0.01]} />
          <meshStandardMaterial color="#FFFFFF" />
        </mesh>
        <mesh position={[0.04, 0.02, 0]} rotation={[0, 0, -Math.PI / 4]}>
          <boxGeometry args={[0.12, 0.02, 0.01]} />
          <meshStandardMaterial color="#FFFFFF" />
        </mesh>
      </group>
    </group>
  )
}

// Partner logo texture loader - must be separate to conditionally use hooks
function PartnerLogoMesh({ logoUrl }: { logoUrl: string }) {
  const texture = useLoader(THREE.TextureLoader, logoUrl)

  return (
    <mesh position={[0, 0, 0.05]}>
      <planeGeometry args={[2.0, 0.6]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  )
}

// Partner logo on a plane
function PartnerLogo({ partnerId }: { partnerId: string }) {
  const logoUrl = useMemo(() => getPartnerLogo(partnerId), [partnerId])

  if (!logoUrl) {
    // Fallback to text if no logo
    return (
      <Suspense fallback={null}>
        <Text
          position={[0, 0, 0.05]}
          fontSize={0.4}
          color="#000000"
          anchorX="center"
          anchorY="middle"
          maxWidth={2.4}
          fontWeight={700}
        >
          {partnerId}
        </Text>
      </Suspense>
    )
  }

  return (
    <Suspense fallback={null}>
      <PartnerLogoMesh logoUrl={logoUrl} />
    </Suspense>
  )
}

interface BeachSignProps {
  position?: [number, number, number]
  name: string
  color: string
  libraryId?: string
  partnerId?: string
  partnerHref?: string
  islandId: string
}

export function BeachSign({
  position = [0, 0, 0],
  name,
  color,
  libraryId,
  partnerId,
  partnerHref,
  islandId,
}: BeachSignProps) {
  const isPartner = !!partnerId
  const groupRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)

  const handleClick = () => {
    if (partnerHref) {
      window.open(partnerHref, '_blank')
    } else if (libraryId) {
      window.location.href = `/${libraryId}`
    }
  }

  // Animate scale based on discovery state
  useFrame(() => {
    if (!groupRef.current) return

    const { nearbyIsland, discoveryProgress, discoveredIslands } =
      useGameStore.getState()
    const isNearby = nearbyIsland?.id === islandId
    const nowDiscovered = discoveredIslands.has(islandId)

    // Target scale: 0 when not nearby and not discovered, 1 when discovering or discovered
    let targetScale = 0
    if (nowDiscovered) {
      targetScale = 1
    } else if (isNearby && discoveryProgress > 0) {
      targetScale = Math.min(1, discoveryProgress * 4)
    }

    // Smooth interpolation - same speed in/out
    const currentScale = groupRef.current.scale.x
    const newScale = THREE.MathUtils.lerp(currentScale, targetScale, 0.25)
    groupRef.current.scale.setScalar(Math.max(0.001, newScale))
  })

  return (
    <group position={position}>
      <group rotation={[0, Math.PI * 0.25, 0]} position={[0, 0.1, 0]}>
        <group
          ref={groupRef}
          rotation={[-1.2, 0, 0]}
          scale={0.001}
          onClick={handleClick}
          onPointerOver={() => {
            setHovered(true)
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            setHovered(false)
            document.body.style.cursor = 'auto'
          }}
        >
          {/* Sign border/frame - black for partners, wood for libraries */}
          <mesh position={[0, 0, -0.03]} castShadow>
            <boxGeometry args={[2.8, 1.2, 0.04]} />
            <meshStandardMaterial
              color={isPartner ? '#1a1a1a' : COLORS.wood.dark}
              roughness={0.7}
            />
          </mesh>
          {/* Sign backing - white for partners, colored for libraries */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[2.6, 1.0, 0.08]} />
            <meshStandardMaterial
              color={isPartner ? '#FFFFFF' : color}
              roughness={0.5}
              emissive={hovered ? (isPartner ? '#FFFFFF' : color) : '#000000'}
              emissiveIntensity={hovered ? 0.15 : 0}
            />
          </mesh>
          {/* Partner logo or library name text */}
          {isPartner ? (
            <Suspense fallback={null}>
              <PartnerLogo partnerId={partnerId!} />
            </Suspense>
          ) : (
            <Suspense fallback={null}>
              <Text
                position={[0, 0, 0.05]}
                fontSize={0.52}
                color="#FFFFFF"
                anchorX="center"
                anchorY="middle"
                maxWidth={2.4}
                fontWeight={700}
              >
                {name}
              </Text>
            </Suspense>
          )}
          {/* Discovery progress border */}
          <DiscoveryBorder width={2.6} height={1.0} islandId={islandId} />
          {/* Green checkmark when discovered */}
          <DiscoveredCheckmark islandId={islandId} />
        </group>
      </group>
    </group>
  )
}
