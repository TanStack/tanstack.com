import {
  useGameStore,
  type OtherPlayer,
  type Cannonball,
  type AIDifficulty,
} from '../../hooks/useGameStore'

// Ship colors by difficulty
const AI_COLORS_BY_DIFFICULTY: Record<AIDifficulty, string[]> = {
  easy: ['#2ecc71', '#1abc9c'], // Greens - friendly looking
  medium: ['#3498db', '#9b59b6'], // Blues/purples
  hard: ['#f39c12', '#e67e22'], // Oranges - warning
  elite: ['#e74c3c', '#c0392b'], // Reds - danger
}

// Stats by difficulty (relative to player's max potential)
// Player max: 175 HP, ~300ms fire rate, dual cannons, double shot
// AI average should be 60-70% of player potential
interface AIStats {
  health: number
  fireCooldown: number // ms between shots
  speed: number
  turnSpeed: number
  accuracy: number // 0-1, affects lead calculation
  aggroDistance: number
  attackDistance: number
}

const AI_STATS: Record<AIDifficulty, AIStats> = {
  // ~40% of player power
  easy: {
    health: 60,
    fireCooldown: 1500,
    speed: 4,
    turnSpeed: 1.5,
    accuracy: 0.2,
    aggroDistance: 40,
    attackDistance: 20,
  },
  // ~60% of player power
  medium: {
    health: 90,
    fireCooldown: 1100,
    speed: 5,
    turnSpeed: 1.8,
    accuracy: 0.35,
    aggroDistance: 55,
    attackDistance: 25,
  },
  // ~75% of player power
  hard: {
    health: 120,
    fireCooldown: 800,
    speed: 6,
    turnSpeed: 2.2,
    accuracy: 0.5,
    aggroDistance: 70,
    attackDistance: 30,
  },
  // ~90% of player power
  elite: {
    health: 150,
    fireCooldown: 600,
    speed: 7,
    turnSpeed: 2.5,
    accuracy: 0.7,
    aggroDistance: 85,
    attackDistance: 35,
  },
}

// Difficulty distribution for 6 AI ships
// Average power = (1*40 + 2*60 + 2*75 + 1*90) / 6 = 66.7% (target: 60-70%)
const DIFFICULTY_DISTRIBUTION: AIDifficulty[] = [
  'easy',
  'medium',
  'medium',
  'hard',
  'hard',
  'elite',
]

// Territorial behavior
const TERRITORY_RADIUS = 35
const TERRITORY_LEASH = 60
const TERRITORY_PULL_STRENGTH = 0.3

// Combat
const AI_OPTIMAL_DISTANCE = 18
const AI_LEAD_FACTOR = 0.5

// Avoidance
const AI_AVOID_DISTANCE = 8
const BOUNDARY_MARGIN = 15

// Battle world boundary
const BATTLE_WORLD_BOUNDARY = 180

interface AIState {
  homePosition: [number, number]
  patrolAngle: number
  patrolTimer: number
  lastFireTime: number
  circleDirection: 1 | -1
  difficulty: AIDifficulty
  stats: AIStats
}

function generateAIOpponents(count: number): {
  opponents: OtherPlayer[]
  states: Map<string, AIState>
} {
  const opponents: OtherPlayer[] = []
  const states = new Map<string, AIState>()

  for (let i = 0; i < count; i++) {
    const sectorAngle = (i / count) * Math.PI * 2
    const minRadius = BATTLE_WORLD_BOUNDARY * 0.4
    const maxRadius = BATTLE_WORLD_BOUNDARY * 0.75
    const radius = minRadius + Math.random() * (maxRadius - minRadius)

    const homeX = Math.cos(sectorAngle) * radius
    const homeZ = Math.sin(sectorAngle) * radius

    const startOffset = 10
    const startX = homeX + (Math.random() - 0.5) * startOffset
    const startZ = homeZ + (Math.random() - 0.5) * startOffset

    const id = `ai-${i}`
    const difficulty =
      DIFFICULTY_DISTRIBUTION[i % DIFFICULTY_DISTRIBUTION.length]
    const stats = AI_STATS[difficulty]
    const colors = AI_COLORS_BY_DIFFICULTY[difficulty]
    const color = colors[Math.floor(Math.random() * colors.length)]

    opponents.push({
      id,
      isAI: true,
      position: [startX, 0, startZ],
      rotation: sectorAngle + Math.PI,
      velocity: stats.speed,
      boatType: 'ship',
      color,
      health: stats.health,
      maxHealth: stats.health,
      difficulty,
    })

    states.set(id, {
      homePosition: [homeX, homeZ],
      patrolAngle: Math.random() * Math.PI * 2,
      patrolTimer: Math.random() * 5,
      lastFireTime: 0,
      circleDirection: Math.random() > 0.5 ? 1 : -1,
      difficulty,
      stats,
    })
  }

  return { opponents, states }
}

function createAICannonball(
  aiPosition: [number, number, number],
  aiRotation: number,
  targetPosition: [number, number, number],
  targetVelocity: [number, number],
  aiId: string,
  side: 'left' | 'right',
  accuracy: number,
): Cannonball {
  const sideMultiplier = side === 'right' ? 1 : -1
  const cannonOffset = 0.5
  const baseSpeed = 18

  const perpX = Math.cos(aiRotation) * sideMultiplier
  const perpZ = -Math.sin(aiRotation) * sideMultiplier
  const fireX = aiPosition[0] + perpX * cannonOffset
  const fireZ = aiPosition[2] + perpZ * cannonOffset

  const dx = targetPosition[0] - fireX
  const dz = targetPosition[2] - fireZ
  const dist = Math.sqrt(dx * dx + dz * dz)

  const flightTime = dist / baseSpeed

  // Apply accuracy to lead calculation (lower accuracy = less leading)
  const effectiveLead = AI_LEAD_FACTOR * accuracy
  const leadX =
    targetPosition[0] + targetVelocity[0] * flightTime * effectiveLead
  const leadZ =
    targetPosition[2] + targetVelocity[1] * flightTime * effectiveLead

  // Add some randomness based on accuracy (lower accuracy = more spread)
  const spread = (1 - accuracy) * 8
  const finalX = leadX + (Math.random() - 0.5) * spread
  const finalZ = leadZ + (Math.random() - 0.5) * spread

  const leadDx = finalX - fireX
  const leadDz = finalZ - fireZ
  const leadDist = Math.sqrt(leadDx * leadDx + leadDz * leadDz)

  const velX = (leadDx / leadDist) * baseSpeed
  const velZ = (leadDz / leadDist) * baseSpeed

  return {
    id: Date.now() + Math.random() * 1000,
    position: [fireX, 0.5, fireZ],
    velocity: [velX, 3, velZ],
    ownerId: aiId,
    createdAt: Date.now(),
  }
}

function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= Math.PI * 2
  while (angle < -Math.PI) angle += Math.PI * 2
  return angle
}

export class AISystem {
  private aiStates: Map<string, AIState> = new Map()
  private initialized = false

  spawn(count: number): void {
    if (this.initialized) return

    const { opponents, states } = generateAIOpponents(count)
    useGameStore.getState().setOtherPlayers(opponents)
    this.aiStates = states
    this.initialized = true
  }

  getDebugTerritories(): Array<{
    homePosition: [number, number]
    color: string
    id: string
  }> {
    const { otherPlayers } = useGameStore.getState()
    const territories: Array<{
      homePosition: [number, number]
      color: string
      id: string
    }> = []

    for (const player of otherPlayers) {
      if (!player.isAI) continue
      const state = this.aiStates.get(player.id)
      if (state) {
        territories.push({
          homePosition: state.homePosition,
          color: player.color,
          id: player.id,
        })
      }
    }

    return territories
  }

  getLeashRadius(): number {
    return TERRITORY_LEASH
  }

  update(delta: number): void {
    const state = useGameStore.getState()
    const {
      otherPlayers,
      boatPosition,
      boatRotation,
      boatVelocity,
      islands,
      expandedIslands,
      worldBoundary,
      cannonballs,
    } = state

    const dt = Math.min(delta, 0.1)
    const newCannonballs: Cannonball[] = []
    const allIslands = [...islands, ...expandedIslands]

    const playerVelX = Math.sin(boatRotation) * boatVelocity
    const playerVelZ = Math.cos(boatRotation) * boatVelocity

    const updatedPlayers = otherPlayers.map((player) => {
      if (!player.isAI) return player

      let aiState = this.aiStates.get(player.id)
      if (!aiState) {
        const difficulty: AIDifficulty = player.difficulty || 'medium'
        aiState = {
          homePosition: [player.position[0], player.position[2]],
          patrolAngle: Math.random() * Math.PI * 2,
          patrolTimer: 0,
          lastFireTime: 0,
          circleDirection: 1,
          difficulty,
          stats: AI_STATS[difficulty],
        }
        this.aiStates.set(player.id, aiState)
      }

      const stats = aiState.stats
      const [px, py, pz] = player.position
      const [homeX, homeZ] = aiState.homePosition

      const dxToPlayer = boatPosition[0] - px
      const dzToPlayer = boatPosition[2] - pz
      const distToPlayer = Math.sqrt(
        dxToPlayer * dxToPlayer + dzToPlayer * dzToPlayer,
      )

      const dxToHome = homeX - px
      const dzToHome = homeZ - pz
      const distToHome = Math.sqrt(dxToHome * dxToHome + dzToHome * dzToHome)

      const isAggro = distToPlayer < stats.aggroDistance
      const isInAttackRange = distToPlayer < stats.attackDistance
      const isBeyondLeash = distToHome > TERRITORY_LEASH
      const isTooFarFromHome = distToHome > TERRITORY_RADIUS && !isAggro

      let targetAngle: number
      let speed: number

      if (isBeyondLeash) {
        targetAngle = Math.atan2(dxToHome, dzToHome)
        speed = stats.speed * 1.2
      } else if (isTooFarFromHome) {
        targetAngle = Math.atan2(dxToHome, dzToHome)
        speed = stats.speed
      } else if (isInAttackRange) {
        const angleToPlayer = Math.atan2(dxToPlayer, dzToPlayer)

        if (distToPlayer < AI_OPTIMAL_DISTANCE - 3) {
          targetAngle =
            angleToPlayer + Math.PI + (aiState.circleDirection * Math.PI) / 3
        } else if (distToPlayer > AI_OPTIMAL_DISTANCE + 3) {
          targetAngle = angleToPlayer + (aiState.circleDirection * Math.PI) / 4
        } else {
          targetAngle = angleToPlayer + (aiState.circleDirection * Math.PI) / 2
        }

        speed = stats.speed * 0.8
      } else if (isAggro) {
        targetAngle = Math.atan2(dxToPlayer, dzToPlayer)
        speed = stats.speed * 1.2
      } else {
        aiState.patrolTimer -= dt
        if (aiState.patrolTimer <= 0) {
          const homeAngle = Math.atan2(dxToHome, dzToHome)
          const randomOffset = (Math.random() - 0.5) * Math.PI
          aiState.patrolAngle =
            homeAngle * TERRITORY_PULL_STRENGTH + randomOffset
          aiState.patrolTimer = 3 + Math.random() * 4
        }
        targetAngle = aiState.patrolAngle
        speed = stats.speed * 0.7
      }

      // Obstacle avoidance
      let avoidX = 0
      let avoidZ = 0

      if (px < -worldBoundary + BOUNDARY_MARGIN) avoidX += 1
      if (px > worldBoundary - BOUNDARY_MARGIN) avoidX -= 1
      if (pz < -worldBoundary + BOUNDARY_MARGIN) avoidZ += 1
      if (pz > worldBoundary - BOUNDARY_MARGIN) avoidZ -= 1

      for (const island of allIslands) {
        const dx = px - island.position[0]
        const dz = pz - island.position[2]
        const dist = Math.sqrt(dx * dx + dz * dz)
        const avoidRadius = island.scale * 3.5 + AI_AVOID_DISTANCE

        if (dist < avoidRadius && dist > 0) {
          const strength = (avoidRadius - dist) / avoidRadius
          avoidX += (dx / dist) * strength * 2
          avoidZ += (dz / dist) * strength * 2
        }
      }

      for (const other of otherPlayers) {
        if (other.id === player.id || !other.isAI) continue
        const dx = px - other.position[0]
        const dz = pz - other.position[2]
        const dist = Math.sqrt(dx * dx + dz * dz)

        if (dist < 8 && dist > 0) {
          const strength = (8 - dist) / 8
          avoidX += (dx / dist) * strength * 0.5
          avoidZ += (dz / dist) * strength * 0.5
        }
      }

      if (avoidX !== 0 || avoidZ !== 0) {
        const avoidAngle = Math.atan2(avoidX, avoidZ)
        const avoidStrength = Math.min(
          1,
          Math.sqrt(avoidX * avoidX + avoidZ * avoidZ),
        )
        targetAngle =
          targetAngle * (1 - avoidStrength * 0.7) +
          avoidAngle * avoidStrength * 0.7
      }

      let newRotation = player.rotation
      let angleDiff = normalizeAngle(targetAngle - newRotation)

      const turnAmount = stats.turnSpeed * dt
      if (Math.abs(angleDiff) > 0.02) {
        newRotation +=
          Math.sign(angleDiff) * Math.min(turnAmount, Math.abs(angleDiff))
      }

      const moveX = Math.sin(newRotation) * speed * dt
      const moveZ = Math.cos(newRotation) * speed * dt

      let newX = px + moveX
      let newZ = pz + moveZ

      newX = Math.max(-worldBoundary + 3, Math.min(worldBoundary - 3, newX))
      newZ = Math.max(-worldBoundary + 3, Math.min(worldBoundary - 3, newZ))

      // Firing logic
      const now = Date.now()
      if (isInAttackRange && now - aiState.lastFireTime > stats.fireCooldown) {
        const angleToPlayerFromShip = Math.atan2(dxToPlayer, dzToPlayer)
        const relativeAngle = normalizeAngle(
          angleToPlayerFromShip - newRotation,
        )
        const absRelAngle = Math.abs(relativeAngle)

        if (absRelAngle > Math.PI / 6 && absRelAngle < (5 * Math.PI) / 6) {
          const side = relativeAngle > 0 ? 'left' : 'right'
          newCannonballs.push(
            createAICannonball(
              [newX, py, newZ],
              newRotation,
              boatPosition,
              [playerVelX, playerVelZ],
              player.id,
              side,
              stats.accuracy,
            ),
          )
          aiState.lastFireTime = now

          if (Math.random() < 0.2) {
            aiState.circleDirection = aiState.circleDirection === 1 ? -1 : 1
          }
        }
      }

      return {
        ...player,
        position: [newX, py, newZ] as [number, number, number],
        rotation: newRotation,
        velocity: speed,
      }
    })

    if (newCannonballs.length > 0) {
      useGameStore.setState({
        otherPlayers: updatedPlayers,
        cannonballs: [...cannonballs, ...newCannonballs],
      })
    } else {
      useGameStore.setState({ otherPlayers: updatedPlayers })
    }
  }

  reset(): void {
    this.initialized = false
    this.aiStates.clear()
  }
}
