import * as React from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import {
  Center,
  Decal,
  Environment,
  AccumulativeShadows,
  RandomizedLight,
  useGLTF,
  useTexture,
} from '@react-three/drei'
import { easing } from 'maath'
import type { ProductListItem } from '~/utils/shopify-queries'
import { shopifyImageUrl } from '~/utils/shopify-format'

type ShopHero3DProps = {
  products: Array<ProductListItem>
}

/**
 * 3D rotating t-shirt hero for the shop landing.
 *
 * Model: `public/shop/shirt.glb` (MIT-licensed, from the threejs-t-shirt
 * project). Product featured images cycle as front-face decals.
 *
 * Lazy-loaded so Three.js doesn't block the initial product grid render.
 */
export function ShopHero3D({ products }: ShopHero3DProps) {
  const images = products
    .map((p) =>
      p.featuredImage
        ? shopifyImageUrl(p.featuredImage.url, { width: 512, format: 'webp' })
        : null,
    )
    .filter(Boolean) as Array<string>

  if (images.length === 0) return null

  return (
    <div className="w-full aspect-[2/1] max-h-[400px] relative">
      <Canvas
        shadows
        camera={{ position: [0, 0, 2], fov: 25 }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        className="!absolute inset-0"
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 5, 5]} intensity={0.6} />
        <directionalLight position={[-5, 3, -5]} intensity={0.4} />
        <Environment preset="city" />
        <Backdrop />
        <Center>
          <RotatingShirt images={images} />
        </Center>
      </Canvas>
    </div>
  )
}

function Backdrop() {
  return (
    <AccumulativeShadows
      temporal
      frames={60}
      alphaTest={0.85}
      scale={10}
      rotation={[Math.PI / 2, 0, 0]}
      position={[0, 0, -0.14]}
    >
      <RandomizedLight
        amount={4}
        radius={9}
        intensity={0.55}
        ambient={0.25}
        position={[5, 5, -10]}
      />
      <RandomizedLight
        amount={4}
        radius={5}
        intensity={0.25}
        ambient={0.55}
        position={[-5, 5, -9]}
      />
    </AccumulativeShadows>
  )
}

function RotatingShirt({ images }: { images: Array<string> }) {
  const { nodes } = useGLTF('/shop/shirt.glb') as any
  const groupRef = React.useRef<any>(null)

  // Cycle through product images
  const [imageIndex, setImageIndex] = React.useState(0)
  React.useEffect(() => {
    if (images.length <= 1) return
    const id = setInterval(() => {
      setImageIndex((prev) => (prev + 1) % images.length)
    }, 3000)
    return () => clearInterval(id)
  }, [images.length])

  const decalTexture = useTexture(images[imageIndex]!)

  // Gentle auto-rotation + subtle mouse follow
  useFrame((state, delta) => {
    if (!groupRef.current) return

    // Auto-rotate slowly
    groupRef.current.rotation.y += delta * 0.3

    // Subtle mouse follow (additive on top of rotation)
    easing.dampE(
      groupRef.current.rotation,
      [
        state.pointer.y * 0.08,
        groupRef.current.rotation.y - state.pointer.x * 0.15,
        0,
      ],
      0.25,
      delta,
    )
  })

  return (
    <group ref={groupRef}>
      <mesh castShadow geometry={nodes.T_Shirt_male.geometry} dispose={null}>
        {/* Replace the flat lambert with a standard PBR material so the
            Environment map lights all sides evenly — no dark back. */}
        <meshStandardMaterial
          color="#ffffff"
          roughness={0.85}
          metalness={0}
          envMapIntensity={0.8}
        />
        <Decal
          position={[0, 0.04, 0.15]}
          rotation={[0, 0, 0]}
          scale={0.17}
          map={decalTexture}
          {...({ depthTest: false, depthWrite: true } as any)}
        />
      </mesh>
    </group>
  )
}

// Preload the model so it's ready when the component mounts
useGLTF.preload('/shop/shirt.glb')
