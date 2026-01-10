import { useGameStore } from '../../hooks/useGameStore'
import { findNearestIsland } from '../../utils/islandGenerator'
import {
  checkIslandCollision,
  checkRockCollision,
  checkShipCollision,
} from '../../utils/collision'
import { getPointerState } from '../../ui/TouchControls'

const MIN_BOAT_SPEED = 3
const MAX_BOAT_SPEED = 10
const MIN_REVERSE_SPEED = 1.5
const MAX_REVERSE_SPEED = 5
const TURN_SPEED = 2.2
const DRAG = 0.96
const ACCELERATION = 0.12
const BOAT_RADIUS = 0.8
const MAX_COINS = 50

function getMaxSpeed(
  coinsCollected: number,
  isReverse: boolean,
  hasSpeedBoost: boolean,
): number {
  const ratio = Math.min(coinsCollected / MAX_COINS, 1)
  let speed: number
  if (isReverse) {
    speed = MIN_REVERSE_SPEED + ratio * (MAX_REVERSE_SPEED - MIN_REVERSE_SPEED)
  } else {
    speed = MIN_BOAT_SPEED + ratio * (MAX_BOAT_SPEED - MIN_BOAT_SPEED)
  }
  return hasSpeedBoost ? speed * 2 : speed
}

function getTargetAngleFromPointer(pointerX: number, pointerY: number): number {
  const centerX = window.innerWidth / 2
  const centerY = window.innerHeight / 2
  const dx = pointerX - centerX
  const dy = pointerY - centerY
  const screenAngle = Math.atan2(-dx, -dy)
  const cameraOffset = -Math.PI * 0.75
  const targetAngle = screenAngle + cameraOffset
  return Math.atan2(Math.sin(targetAngle), Math.cos(targetAngle))
}

function angleDifference(target: number, current: number): number {
  let diff = target - current
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  return diff
}

export class BoatControlSystem {
  private spaceHeld = false
  private boundKeyDown: (e: KeyboardEvent) => void
  private boundKeyUp: (e: KeyboardEvent) => void

  constructor() {
    this.boundKeyDown = this.handleKeyDown.bind(this)
    this.boundKeyUp = this.handleKeyUp.bind(this)
  }

  init(): void {
    window.addEventListener('keydown', this.boundKeyDown)
    window.addEventListener('keyup', this.boundKeyUp)
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const {
      setMovingForward,
      setMovingBackward,
      setTurningLeft,
      setTurningRight,
      fireCannon,
      shipStats,
    } = useGameStore.getState()

    if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault()
      setMovingForward(true)
    }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      e.preventDefault()
      setMovingBackward(true)
    }
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      e.preventDefault()
      setTurningLeft(true)
    }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      e.preventDefault()
      setTurningRight(true)
    }
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault()
      if (shipStats.gatlingGuns) {
        this.spaceHeld = true
      }
      fireCannon()
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    const {
      setMovingForward,
      setMovingBackward,
      setTurningLeft,
      setTurningRight,
    } = useGameStore.getState()

    if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      setMovingForward(false)
    }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      setMovingBackward(false)
    }
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      setTurningLeft(false)
    }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      setTurningRight(false)
    }
    if (e.code === 'Space') {
      this.spaceHeld = false
    }
  }

  update(delta: number): void {
    const state = useGameStore.getState()
    const {
      boatPosition,
      boatRotation,
      boatVelocity,
      isMovingForward,
      isMovingBackward,
      isTurningLeft,
      isTurningRight,
      islands,
      expandedIslands,
      stage,
      rockColliders,
      coinsCollected,
      shipStats,
      speedBoostEndTime,
      setBoatPosition,
      setBoatRotation,
      setBoatVelocity,
      fireGatling,
    } = state

    // Combine islands for collision in battle stage (includes partner islands)
    const allIslands =
      stage === 'battle' ? [...islands, ...expandedIslands] : islands

    // Fire gatling while space is held
    if (this.spaceHeld && shipStats.gatlingGuns) {
      fireGatling()
    }

    const dt = Math.min(delta, 0.1)

    const hasSpeedBoost = !!(
      speedBoostEndTime && Date.now() < speedBoostEndTime
    )
    const maxForwardSpeed = getMaxSpeed(coinsCollected, false, hasSpeedBoost)
    const maxReverseSpeed = getMaxSpeed(coinsCollected, true, hasSpeedBoost)

    const pointer = getPointerState()

    let newRotation = boatRotation
    let newVelocity = boatVelocity

    if (pointer.active) {
      newVelocity = Math.min(newVelocity + ACCELERATION, maxForwardSpeed)

      const targetAngle = getTargetAngleFromPointer(pointer.x, pointer.y)
      const angleDiff = angleDifference(targetAngle, boatRotation)
      const angleDiffDeg = Math.abs(angleDiff) * (180 / Math.PI)

      const stopThreshold = 1
      const slowThreshold = 10

      if (angleDiffDeg > stopThreshold) {
        let turnMultiplier = 1
        if (angleDiffDeg < slowThreshold) {
          turnMultiplier = 0.2 + 0.8 * (angleDiffDeg / slowThreshold)
        }

        const turnAmount = TURN_SPEED * turnMultiplier * dt
        if (angleDiff > 0) {
          newRotation += Math.min(turnAmount, angleDiff)
        } else {
          newRotation -= Math.min(turnAmount, -angleDiff)
        }
      }
    } else {
      if (isTurningLeft) {
        newRotation += TURN_SPEED * dt
      }
      if (isTurningRight) {
        newRotation -= TURN_SPEED * dt
      }

      if (isMovingForward) {
        newVelocity = Math.min(newVelocity + ACCELERATION, maxForwardSpeed)
      } else if (isMovingBackward) {
        newVelocity = Math.max(newVelocity - ACCELERATION, -maxReverseSpeed)
      } else {
        newVelocity *= DRAG
        if (Math.abs(newVelocity) < 0.01) newVelocity = 0
      }
    }

    // Movement
    const moveX = Math.sin(newRotation) * newVelocity * dt
    const moveZ = Math.cos(newRotation) * newVelocity * dt

    let newX = boatPosition[0] + moveX
    let newZ = boatPosition[2] + moveZ

    // Island collision (includes partner islands in battle stage)
    const islandCollision = checkIslandCollision(
      newX,
      newZ,
      allIslands,
      BOAT_RADIUS,
    )
    if (islandCollision.collides) {
      newX += islandCollision.pushX
      newZ += islandCollision.pushZ
      newVelocity *= 0.92
    }

    // Rock collision
    const rockCollision = checkRockCollision(
      newX,
      newZ,
      rockColliders,
      BOAT_RADIUS,
    )
    if (rockCollision.collides) {
      newX += rockCollision.pushX
      newZ += rockCollision.pushZ
      newVelocity *= 0.88
    }

    // Ship-to-ship collision (with AI ships)
    const { otherPlayers } = useGameStore.getState()
    const AI_SHIP_RADIUS = 1.2
    for (const ship of otherPlayers) {
      const dx = newX - ship.position[0]
      const dz = newZ - ship.position[2]
      const dist = Math.sqrt(dx * dx + dz * dz)
      const minDist = BOAT_RADIUS + AI_SHIP_RADIUS

      if (dist < minDist && dist > 0) {
        const overlap = minDist - dist
        const pushStrength = overlap * 0.2
        newX += (dx / dist) * pushStrength
        newZ += (dz / dist) * pushStrength
        newVelocity *= 0.85
      }
    }

    // Second pass
    const islandCollision2 = checkIslandCollision(
      newX,
      newZ,
      allIslands,
      BOAT_RADIUS,
    )
    if (islandCollision2.collides) {
      newX += islandCollision2.pushX * 0.5
      newZ += islandCollision2.pushZ * 0.5
    }

    const rockCollision2 = checkRockCollision(
      newX,
      newZ,
      rockColliders,
      BOAT_RADIUS,
    )
    if (rockCollision2.collides) {
      newX += rockCollision2.pushX * 0.5
      newZ += rockCollision2.pushZ * 0.5
    }

    // Boundary handling
    const { worldBoundary, boundaryEdges, setBoundaryEdges } =
      useGameStore.getState()

    const BOUNDARY_THRESHOLD = 2
    const atWest = newX <= -worldBoundary + BOUNDARY_THRESHOLD
    const atEast = newX >= worldBoundary - BOUNDARY_THRESHOLD
    const atSouth = newZ <= -worldBoundary + BOUNDARY_THRESHOLD
    const atNorth = newZ >= worldBoundary - BOUNDARY_THRESHOLD

    if (
      boundaryEdges.north !== atNorth ||
      boundaryEdges.south !== atSouth ||
      boundaryEdges.east !== atEast ||
      boundaryEdges.west !== atWest
    ) {
      setBoundaryEdges({
        north: atNorth,
        south: atSouth,
        east: atEast,
        west: atWest,
      })
    }

    newX = Math.max(-worldBoundary, Math.min(worldBoundary, newX))
    newZ = Math.max(-worldBoundary, Math.min(worldBoundary, newZ))

    const newPosition: [number, number, number] = [newX, boatPosition[1], newZ]

    if (newRotation !== boatRotation) {
      setBoatRotation(newRotation)
    }
    if (newVelocity !== boatVelocity) {
      setBoatVelocity(newVelocity)
    }
    if (newX !== boatPosition[0] || newZ !== boatPosition[2]) {
      setBoatPosition(newPosition)
    }

    // Update nearby island detection (uses allIslands which includes partner islands in battle stage)
    const nearby = findNearestIsland(newPosition, allIslands, 10)
    const {
      nearbyIsland,
      discoveryProgress,
      setNearbyIsland,
      setDiscoveryProgress,
    } = useGameStore.getState()

    if (nearby?.id !== nearbyIsland?.id) {
      setNearbyIsland(nearby)
      if (discoveryProgress > 0) {
        setDiscoveryProgress(0)
      }
    }
  }

  dispose(): void {
    window.removeEventListener('keydown', this.boundKeyDown)
    window.removeEventListener('keyup', this.boundKeyUp)
    this.spaceHeld = false
  }
}
