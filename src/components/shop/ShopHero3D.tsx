import * as React from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Decal, Environment, useGLTF, useTexture } from '@react-three/drei'
import { easing } from 'maath'

type ShopHero3DProps = {
  isDark?: boolean
}

const BRAND_IMAGES = {
  light: [
    '/images/logos/logo-color-600.png',
    '/images/logos/splash-light.png',
    '/images/logos/logo-color-banner-600.png',
  ],
  dark: [
    '/images/logos/logo-color-600.png',
    '/images/logos/splash-dark.png',
    '/images/logos/logo-color-banner-600.png',
  ],
}

const DEBUG = true // flip to false when done tuning

export function ShopHero3D({ isDark = false }: ShopHero3DProps) {
  const images = isDark ? BRAND_IMAGES.dark : BRAND_IMAGES.light

  // Debug overrides — these feed into the scene when DEBUG is on
  const [debugDecal, setDebugDecal] = React.useState({
    x: 0.17,
    y: 0.09,
    z: 0.1,
  })
  const [debugDecalRot, setDebugDecalRot] = React.useState({
    x: 0,
    y: 0.785,
    z: 0,
  }) // 0.785 ≈ π*0.25
  const [debugScale, setDebugScale] = React.useState(0.05)
  const [debugShirtPos, setDebugShirtPos] = React.useState({
    x: -0.06,
    y: -0.05,
    z: 0,
  })
  const [debugShirtRot, setDebugShirtRot] = React.useState({
    x: 0,
    y: -0.45,
    z: 0.02,
  })

  const debugValues = DEBUG
    ? {
        decal: [debugDecal.x, debugDecal.y, debugDecal.z] as [
          number,
          number,
          number,
        ],
        decalRotation: [debugDecalRot.x, debugDecalRot.y, debugDecalRot.z] as [
          number,
          number,
          number,
        ],
        scale: debugScale,
        shirtPos: [debugShirtPos.x, debugShirtPos.y, debugShirtPos.z] as [
          number,
          number,
          number,
        ],
        shirtRot: [debugShirtRot.x, debugShirtRot.y, debugShirtRot.z] as [
          number,
          number,
          number,
        ],
      }
    : null

  const copySnippet = () => {
    const v = debugValues!
    const snippet = `{
  decal: [${v.decal.map((n) => n.toFixed(3)).join(', ')}] as const,
  decalRotation: [${v.decalRotation.map((n) => n.toFixed(3)).join(', ')}] as [number, number, number],
  scale: ${v.scale.toFixed(3)},
  shirtPos: [${v.shirtPos.map((n) => n.toFixed(3)).join(', ')}] as [number, number, number],
  shirtRot: [${v.shirtRot.map((n) => n.toFixed(3)).join(', ')}] as [number, number, number],
}`
    navigator.clipboard.writeText(snippet)
  }

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [0.06, 0.095, 0.45], fov: 25 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        className="!absolute inset-0"
      >
        <Scene images={images} isDark={isDark} debugOverride={debugValues} />
      </Canvas>

      {DEBUG ? (
        <div className="absolute top-2 right-2 z-50 bg-black/80 text-white text-[10px] p-3 rounded-lg flex flex-col gap-2 max-h-[95%] overflow-y-auto w-56 font-mono">
          <div className="font-bold text-xs mb-1">Decal Editor</div>

          <SliderGroup
            label="Decal Pos"
            value={debugDecal}
            onChange={setDebugDecal}
            min={-0.3}
            max={0.3}
            step={0.005}
          />
          <SliderGroup
            label="Decal Rot"
            value={debugDecalRot}
            onChange={setDebugDecalRot}
            min={-3.14}
            max={3.14}
            step={0.01}
          />
          <SliderRow
            label="Scale"
            value={debugScale}
            onChange={setDebugScale}
            min={0.01}
            max={0.4}
            step={0.005}
          />
          <SliderGroup
            label="Shirt Pos"
            value={debugShirtPos}
            onChange={setDebugShirtPos}
            min={-0.2}
            max={0.2}
            step={0.005}
          />
          <SliderGroup
            label="Shirt Rot"
            value={debugShirtRot}
            onChange={setDebugShirtRot}
            min={-1.5}
            max={1.5}
            step={0.01}
          />

          <button
            type="button"
            onClick={copySnippet}
            className="mt-2 px-2 py-1 bg-blue-600 rounded text-[10px] hover:bg-blue-500"
          >
            Copy snippet
          </button>
        </div>
      ) : null}
    </div>
  )
}

function SliderRow({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
}) {
  return (
    <label className="flex items-center gap-1">
      <span className="w-10 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-2"
      />
      <span className="w-10 text-right">{value.toFixed(3)}</span>
    </label>
  )
}

function SliderGroup({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string
  value: { x: number; y: number; z: number }
  onChange: (v: { x: number; y: number; z: number }) => void
  min: number
  max: number
  step: number
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="font-bold opacity-60">{label}</div>
      {(['x', 'y', 'z'] as const).map((axis) => (
        <SliderRow
          key={axis}
          label={axis}
          value={value[axis]}
          onChange={(v) => onChange({ ...value, [axis]: v })}
          min={min}
          max={max}
          step={step}
        />
      ))}
    </div>
  )
}

type DebugOverride = {
  decal: [number, number, number]
  decalRotation: [number, number, number]
  scale: number
  shirtPos: [number, number, number]
  shirtRot: [number, number, number]
} | null

function Scene({
  images,
  isDark,
  debugOverride,
}: {
  images: Array<string>
  isDark: boolean
  debugOverride?: DebugOverride
}) {
  const { gl } = useThree()

  React.useEffect(() => {
    gl.setClearColor(isDark ? '#0a0a0b' : '#e8e6e4', 1)
  }, [gl, isDark])

  return (
    <>
      {/*
       * Match the reference: large soft wrap-around light (HDRI) as the
       * primary source. This gives even illumination with a natural
       * highlight gradient across curved surfaces — exactly what makes
       * that Remix shirt look good. "studio" preset is a bright white
       * softbox ring which is closest to a product-photography lightbox.
       *
       * The HDRI intensity IS the exposure control — no separate
       * spotlight needed. Just one subtle directional for a slight
       * left-to-right gradient (the reference has the highlight
       * slightly left of center).
       */}
      <Environment
        preset="studio"
        environmentIntensity={isDark ? 0.35 : 0.85}
      />

      {/* Gentle directional for a soft highlight gradient — from upper-left-front */}
      <directionalLight
        position={[-2, 3, 3]}
        intensity={isDark ? 0.3 : 0.6}
        color={isDark ? '#b8c0d0' : '#ffffff'}
      />

      {/* Very subtle fill from below-right to open up sleeve shadows */}
      <directionalLight
        position={[2, -1, 2]}
        intensity={isDark ? 0.05 : 0.1}
        color="#e8e0f0"
      />

      <RotatingShirt
        images={images}
        isDark={isDark}
        debugOverride={debugOverride}
      />
    </>
  )
}

function useFabricTexture(isDark: boolean) {
  return React.useMemo(() => {
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    const base = isDark ? '#1a1a1a' : '#f8f6f4'
    ctx.fillStyle = base
    ctx.fillRect(0, 0, size, size)

    const hStroke = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'
    ctx.lineWidth = 1
    for (let y = 0; y < size; y += 2) {
      ctx.strokeStyle = hStroke
      ctx.beginPath()
      ctx.moveTo(0, y + (Math.random() - 0.5) * 0.6)
      ctx.lineTo(size, y + (Math.random() - 0.5) * 0.6)
      ctx.stroke()
    }

    const vStroke = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.03)'
    for (let x = 0; x < size; x += 2) {
      ctx.strokeStyle = vStroke
      ctx.beginPath()
      ctx.moveTo(x + (Math.random() - 0.5) * 0.6, 0)
      ctx.lineTo(x + (Math.random() - 0.5) * 0.6, size)
      ctx.stroke()
    }

    const imageData = ctx.getImageData(0, 0, size, size)
    const { data } = imageData
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 14
      data[i] = Math.min(255, Math.max(0, data[i]! + noise))
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1]! + noise))
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2]! + noise))
    }
    ctx.putImageData(imageData, 0, 0)

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(12, 12)
    texture.anisotropy = 8
    return texture
  }, [isDark])
}

function useBumpTexture() {
  return React.useMemo(() => {
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    ctx.fillStyle = '#808080'
    ctx.fillRect(0, 0, size, size)

    ctx.lineWidth = 1
    for (let y = 0; y < size; y += 2) {
      ctx.strokeStyle =
        y % 4 === 0 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)'
      ctx.beginPath()
      ctx.moveTo(0, y + (Math.random() - 0.5))
      ctx.lineTo(size, y + (Math.random() - 0.5))
      ctx.stroke()
    }

    for (let x = 0; x < size; x += 3) {
      ctx.strokeStyle = 'rgba(0,0,0,0.05)'
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, size)
      ctx.stroke()
    }

    const imageData = ctx.getImageData(0, 0, size, size)
    const { data } = imageData
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 20
      data[i] = Math.min(255, Math.max(0, data[i]! + n))
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1]! + n))
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2]! + n))
    }
    ctx.putImageData(imageData, 0, 0)

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(12, 12)
    texture.anisotropy = 8
    return texture
  }, [])
}

function RotatingShirt({
  images,
  isDark,
  debugOverride,
}: {
  images: Array<string>
  isDark: boolean
  debugOverride?: DebugOverride
}) {
  const { nodes } = useGLTF('/shop/shirt.glb') as any
  const groupRef = React.useRef<any>(null)
  const fabricMap = useFabricTexture(isDark)
  const bumpMap = useBumpTexture()

  // Each placement defines the decal + a camera-framing pose for the shirt
  // (position offset + rotation) so the view animates to showcase the print.
  const PLACEMENTS = React.useMemo(
    () => [
      {
        // Left chest patch — shift right, turn slightly to show left chest
        decal: [0.06, 0.095, 0.14] as const,
        scale: 0.07,
        shirtPos: [-0.02, -0.06, 0] as [number, number, number],
        shirtRot: [-0.03, -0.15, 0.01] as [number, number, number],
      },
      {
        // Center chest full — straight on, centered
        decal: [0, 0.06, 0.15] as const,
        scale: 0.18,
        shirtPos: [0, -0.04, 0] as [number, number, number],
        shirtRot: [-0.04, -0.08, 0] as [number, number, number],
      },
      {
        // Oversized — pull down to show more shirt, slight angle
        decal: [0, 0.02, 0.15] as const,
        scale: 0.35,
        shirtPos: [0, -0.1, -0.05] as [number, number, number],
        shirtRot: [-0.02, -0.12, 0.01] as [number, number, number],
      },
      {
        // Right chest patch — shift left, turn to show right
        decal: [-0.06, 0.095, 0.14] as const,
        scale: 0.07,
        shirtPos: [0.02, -0.06, 0] as [number, number, number],
        shirtRot: [-0.03, 0.15, -0.01] as [number, number, number],
      },
      {
        // Left sleeve — decal rotated 90° on Y to project sideways onto the sleeve face
        decal: [0.17, 0.09, 0.1] as const,
        decalRotation: [0, Math.PI * 0.25, 0] as [number, number, number],
        scale: 0.05,
        shirtPos: [-0.06, -0.05, 0] as [number, number, number],
        shirtRot: [0, -0.45, 0.02] as [number, number, number],
      },
    ],
    [],
  )

  // Cycle through random image + placement combos
  const [combo, setCombo] = React.useState({ imageIdx: 0, placementIdx: 0 })
  React.useEffect(() => {
    if (debugOverride) return // don't cycle in debug mode
    const id = setInterval(() => {
      setCombo((prev) => {
        let nextImage: number
        let nextPlacement: number
        do {
          nextImage = Math.floor(Math.random() * images.length)
          nextPlacement = Math.floor(Math.random() * PLACEMENTS.length)
        } while (
          nextImage === prev.imageIdx &&
          nextPlacement === prev.placementIdx
        )
        return { imageIdx: nextImage, placementIdx: nextPlacement }
      })
    }, 1500)
    return () => clearInterval(id)
  }, [images.length, PLACEMENTS.length, debugOverride])

  const decalTexture = useTexture(images[combo.imageIdx]!)
  const placement = PLACEMENTS[combo.placementIdx]!

  // In debug mode, use overrides directly; otherwise use placement presets
  const activeDecalPos = debugOverride?.decal ?? [...placement.decal]
  const activeDecalRot = debugOverride?.decalRotation ??
    placement.decalRotation ?? [0, 0, 0]
  const activeScale = debugOverride?.scale ?? placement.scale
  const activeShirtPos = debugOverride?.shirtPos ?? placement.shirtPos
  const activeShirtRot = debugOverride?.shirtRot ?? placement.shirtRot

  useFrame((state, delta) => {
    if (!groupRef.current) return

    const targetRot: [number, number, number] = [
      activeShirtRot[0] + state.pointer.y * 0.02,
      activeShirtRot[1] + state.pointer.x * -0.03,
      activeShirtRot[2],
    ]

    easing.damp3(groupRef.current.position, activeShirtPos, 0.4, delta)
    easing.dampE(groupRef.current.rotation, targetRot, 0.4, delta)
  })

  return (
    <group ref={groupRef}>
      <mesh geometry={nodes.T_Shirt_male.geometry} dispose={null}>
        <meshPhysicalMaterial
          color={isDark ? '#222224' : '#ffffff'}
          map={fabricMap}
          bumpMap={bumpMap}
          bumpScale={0.02}
          roughness={0.85}
          metalness={0}
          envMapIntensity={isDark ? 0.5 : 1.0}
          sheen={isDark ? 0.4 : 0.6}
          sheenRoughness={0.5}
          sheenColor={isDark ? '#333338' : '#eae5e0'}
          side={THREE.DoubleSide}
        />
        <Decal
          position={[...activeDecalPos]}
          rotation={[...activeDecalRot]}
          scale={activeScale}
        >
          <meshPhysicalMaterial
            map={decalTexture}
            transparent
            polygonOffset
            polygonOffsetFactor={-1}
            roughness={0.95}
            metalness={0}
            envMapIntensity={0.15}
            color={isDark ? '#aaaaaa' : '#bbbbbb'}
          />
        </Decal>
      </mesh>
    </group>
  )
}

useGLTF.preload('/shop/shirt.glb')
