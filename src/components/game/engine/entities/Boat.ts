import * as THREE from 'three'
import { modelLoader } from '../loaders/ModelLoader'
import { getWaveHeight } from './Ocean'
import type { BoatType } from '../../hooks/useGameStore'

export class Boat {
  group: THREE.Group
  private wakeGeometry: THREE.BufferGeometry
  private wakeMesh: THREE.Points
  private boatModel: THREE.Group | null = null
  private cannonGroup: THREE.Group | null = null
  private boatType: BoatType = 'dinghy'

  constructor() {
    this.group = new THREE.Group()

    // Wake particles
    const count = 100
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0
      positions[i * 3 + 1] = -10 // Start hidden
      positions[i * 3 + 2] = 0
      sizes[i] = 0
    }

    this.wakeGeometry = new THREE.BufferGeometry()
    this.wakeGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3),
    )
    this.wakeGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

    const wakeMaterial = new THREE.PointsMaterial({
      color: '#FFFFFF',
      size: 0.5,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
    })

    this.wakeMesh = new THREE.Points(this.wakeGeometry, wakeMaterial)
    this.wakeMesh.frustumCulled = false
  }

  setBoatType(type: BoatType): void {
    if (type === this.boatType && this.boatModel) return

    // Remove old model
    if (this.boatModel) {
      this.group.remove(this.boatModel)
      this.boatModel = null
      this.cannonGroup = null
    }

    this.boatType = type

    if (type === 'dinghy') {
      const tint = new THREE.Color('#C4A484')
      this.boatModel = modelLoader.clone('/models/rowboat.glb', tint)
      this.boatModel.scale.setScalar(0.4)
      this.group.add(this.boatModel)
    } else {
      const tint = new THREE.Color('#FFEEDD')
      this.boatModel = modelLoader.clone('/models/ship.glb', tint)
      this.boatModel.scale.setScalar(0.28)
      this.group.add(this.boatModel)

      // Add cannon
      this.cannonGroup = new THREE.Group()
      this.cannonGroup.position.set(0.4, 0.3, 0)

      // Cannon base
      const baseGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.06, 12)
      const baseMat = new THREE.MeshStandardMaterial({
        color: '#4a4a4a',
        metalness: 0.8,
        roughness: 0.3,
      })
      const base = new THREE.Mesh(baseGeo, baseMat)
      base.castShadow = true
      this.cannonGroup.add(base)

      // Cannon barrel
      const barrelGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.25, 12)
      const barrelMat = new THREE.MeshStandardMaterial({
        color: '#3a3a3a',
        metalness: 0.9,
        roughness: 0.2,
      })
      const barrel = new THREE.Mesh(barrelGeo, barrelMat)
      barrel.position.set(0.15, 0.02, 0)
      barrel.rotation.z = Math.PI / 2
      barrel.castShadow = true
      this.cannonGroup.add(barrel)

      // Cannon muzzle
      const muzzleGeo = new THREE.CylinderGeometry(0.055, 0.04, 0.04, 12)
      const muzzleMat = new THREE.MeshStandardMaterial({
        color: '#2a2a2a',
        metalness: 0.9,
        roughness: 0.2,
      })
      const muzzle = new THREE.Mesh(muzzleGeo, muzzleMat)
      muzzle.position.set(0.27, 0.02, 0)
      muzzle.rotation.z = Math.PI / 2
      muzzle.castShadow = true
      this.cannonGroup.add(muzzle)

      this.group.add(this.cannonGroup)
    }
  }

  update(
    time: number,
    position: [number, number, number],
    rotation: number,
    velocity: number,
  ): void {
    const waveY = getWaveHeight(position[0], position[2], time)

    // Bobbing and tilting
    const isDinghy = this.boatType === 'dinghy'
    const bobY =
      Math.sin(time * (isDinghy ? 2.2 : 1.8)) * (isDinghy ? 0.05 : 0.03)
    const bobRoll =
      Math.sin(time * (isDinghy ? 1.8 : 1.5)) * (isDinghy ? 0.06 : 0.03)
    const bobPitch =
      Math.sin(time * (isDinghy ? 2.5 : 2.2)) * (isDinghy ? 0.04 : 0.02)

    // Wave-based tilting
    const offset = isDinghy ? 0.2 : 0.3
    const waveTiltX =
      getWaveHeight(position[0] + offset, position[2], time) - waveY
    const waveTiltZ =
      getWaveHeight(position[0], position[2] + offset, time) - waveY
    const tiltMultiplier = isDinghy ? 0.5 : 0.4

    this.group.position.set(
      position[0],
      waveY + bobY + (isDinghy ? 0.15 : 0.2),
      position[2],
    )
    this.group.rotation.set(
      bobPitch + waveTiltZ * tiltMultiplier,
      rotation,
      bobRoll + waveTiltX * tiltMultiplier,
    )

    // Animate cannon sway (ship only)
    if (this.cannonGroup) {
      this.cannonGroup.rotation.y = Math.sin(time * 0.5) * 0.1
    }

    // Update wake particles
    this.updateWake(position, rotation, velocity)
  }

  private updateWake(
    position: [number, number, number],
    rotation: number,
    velocity: number,
  ): void {
    const positions = this.wakeGeometry.attributes
      .position as THREE.BufferAttribute
    const sizes = this.wakeGeometry.attributes.size as THREE.BufferAttribute
    const isDinghy = this.boatType === 'dinghy'
    const sizeMultiplier = isDinghy ? 0.99 : 0.995

    // Shift all particles back
    for (let i = positions.count - 1; i > 0; i--) {
      positions.setXYZ(
        i,
        positions.getX(i - 1),
        positions.getY(i - 1) - 0.002,
        positions.getZ(i - 1),
      )
      const currentSize = sizes.getX(i - 1)
      sizes.setX(i, currentSize > 0.01 ? currentSize * sizeMultiplier : 0)
    }

    // Add new particles when moving
    if (velocity > 0.05 && Math.random() < 0.25) {
      const backOffset = isDinghy ? 0.5 : 0.7
      const spread = (Math.random() - 0.5) * (isDinghy ? 0.3 : 0.5)

      const newX =
        position[0] -
        Math.sin(rotation) * backOffset +
        Math.cos(rotation) * spread
      const newZ =
        position[2] -
        Math.cos(rotation) * backOffset -
        Math.sin(rotation) * spread

      positions.setXYZ(0, newX, isDinghy ? -0.35 : 0.05, newZ)
      sizes.setX(
        0,
        (isDinghy ? 0.12 : 0.2) + velocity * (isDinghy ? 0.08 : 0.15),
      )
    } else {
      positions.setXYZ(0, position[0], -10, position[2])
      sizes.setX(0, 0)
    }

    positions.needsUpdate = true
    sizes.needsUpdate = true
  }

  getWakeMesh(): THREE.Points {
    return this.wakeMesh
  }

  dispose(): void {
    this.wakeGeometry.dispose()
    ;(this.wakeMesh.material as THREE.PointsMaterial).dispose()

    if (this.boatModel) {
      this.boatModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose()
          if (child.material) {
            ;(child.material as THREE.Material).dispose()
          }
        }
      })
    }

    if (this.cannonGroup) {
      this.cannonGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose()
          if (child.material) {
            ;(child.material as THREE.Material).dispose()
          }
        }
      })
    }
  }
}
