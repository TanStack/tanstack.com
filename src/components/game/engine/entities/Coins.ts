import * as THREE from 'three'
import type { CoinData } from '../../hooks/useGameStore'

const RENDER_DISTANCE = 50
const MAX_COINS = 100

export class Coins {
  group: THREE.Group
  private instancedMesh: THREE.InstancedMesh
  private coins: CoinData[] = []
  private matrix: THREE.Matrix4
  private visibleIndices: Map<number, number> = new Map() // coinId -> instanceIndex

  constructor() {
    this.group = new THREE.Group()
    this.matrix = new THREE.Matrix4()

    // Create instanced mesh for coins
    const geometry = new THREE.CylinderGeometry(0.35, 0.35, 0.08, 12)
    const material = new THREE.MeshStandardMaterial({
      color: '#FFD700',
      metalness: 0.8,
      roughness: 0.3,
      emissive: '#FF8C00',
      emissiveIntensity: 0.4,
    })

    this.instancedMesh = new THREE.InstancedMesh(geometry, material, MAX_COINS)
    this.instancedMesh.count = 0
    this.instancedMesh.frustumCulled = false
    this.group.add(this.instancedMesh)
  }

  setCoins(coins: CoinData[]): void {
    this.coins = coins
  }

  update(time: number, boatPosition: [number, number, number]): void {
    this.visibleIndices.clear()
    let instanceIndex = 0

    for (const coin of this.coins) {
      if (coin.collected) continue

      // Distance culling
      const dx = coin.position[0] - boatPosition[0]
      const dz = coin.position[2] - boatPosition[2]
      const distSq = dx * dx + dz * dz

      if (distSq > RENDER_DISTANCE * RENDER_DISTANCE) continue
      if (instanceIndex >= MAX_COINS) break

      // Animation: rotation and bobbing
      const rotation = time * 2
      const bobY = coin.position[1] + Math.sin(time * 2 + coin.id * 0.5) * 0.15

      // Set transform
      this.matrix.makeRotationY(rotation)
      this.matrix.setPosition(coin.position[0], bobY, coin.position[2])
      this.instancedMesh.setMatrixAt(instanceIndex, this.matrix)

      this.visibleIndices.set(coin.id, instanceIndex)
      instanceIndex++
    }

    this.instancedMesh.count = instanceIndex
    this.instancedMesh.instanceMatrix.needsUpdate = true
  }

  dispose(): void {
    this.instancedMesh.geometry.dispose()
    ;(this.instancedMesh.material as THREE.Material).dispose()
  }
}
