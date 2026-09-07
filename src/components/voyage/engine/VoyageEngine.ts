import * as THREE from 'three'
import { modelLoader } from '../../game/engine/loaders/ModelLoader'
import { BANDS, PLANETS, type Planet } from '../planets'
import { PLAYER_MAX_HEALTH, useVoyageStore } from '../store'

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------
const WORLD_RADIUS = 150
const THRUST_ACCEL = 30
const MAX_SPEED = 38
const REVERSE_SPEED = 16
const TURN_SPEED = 1.9
const STAR_COUNT = 2200
const TRAIL_MAX = 600
const VISIT_RANGE = 13 // extra distance (beyond planet radius) to "visit"

// Combat
const ENEMY_COUNT = 7
const ENEMY_RADIUS = 3.6 // collision radius for cannonballs vs pirate
const ENEMY_MAX_HEALTH = 3 // cannonball hits to sink
const ENEMY_SPEED = 14
const ENEMY_AGGRO = 46 // pursue only when you come near (kept below the
// spawn standoff so open space — and the spawn point — is safe to cruise)
const ENEMY_FIRE_RANGE = 42
const ENEMY_FIRE_INTERVAL = 2.8 // seconds between enemy shots
const ENEMY_RESPAWN_DELAY = 8 // seconds before a sunk pirate returns
const ENEMY_BAND_TOLERANCE = 26 // must be within this Y gap to fight
const PLAYER_RADIUS = 3.0
const PLAYER_FIRE_INTERVAL = 0.3 // seconds between player shots
const PLAYER_BALL_SPEED = 95
const PLAYER_BALL_LIFE = 1.5
const PLAYER_BALL_DAMAGE = 1
const ENEMY_BALL_SPEED = 58
const ENEMY_BALL_LIFE = 2.4
const ENEMY_BALL_DAMAGE = 8
const COLLISION_DAMAGE = 16 // ramming a pirate
const HULL_REGEN = 6 // hull points/sec recovered when not under fire
const REGEN_DELAY = 3 // seconds after a hit before regen kicks in
const RESPAWN_DELAY = 2.8 // player shipwreck → respawn
const INVULN_TIME = 2.6 // post-respawn grace
const BURST_MAX = 700

interface TrailParticle {
  x: number
  y: number
  z: number
  birth: number
  life: number
  size: number
  color: THREE.Color
}

interface BurstParticle {
  pos: THREE.Vector3
  vel: THREE.Vector3
  birth: number
  life: number
  size: number
  color: THREE.Color
}

interface Projectile {
  pos: THREE.Vector3
  vel: THREE.Vector3
  life: number
  fromPlayer: boolean
  damage: number
  mesh: THREE.Mesh
}

interface Enemy {
  group: THREE.Group
  pos: THREE.Vector3
  yaw: number
  roll: number
  bandY: number
  health: number
  alive: boolean
  fireTimer: number
  respawnTimer: number
  wanderSeed: number
}

// End-game boss gauntlet — escalating "boss men" unlocked after charting
// every world. Each tier is bigger, tougher, and fires harder.
interface BossLevel {
  name: string
  color: string
  health: number
  scale: number
  speed: number
  fireInterval: number
  ballDamage: number
  shots: number
  escorts: number
  reward: number
}

const BOSS_LEVELS: BossLevel[] = [
  {
    name: 'Bronze Marauder',
    color: '#cd7f32',
    health: 9,
    scale: 1.0,
    speed: 17,
    fireInterval: 1.7,
    ballDamage: 9,
    shots: 1,
    escorts: 0,
    reward: 1000,
  },
  {
    name: 'Silver Corsair',
    color: '#cfd6de',
    health: 15,
    scale: 1.18,
    speed: 20,
    fireInterval: 1.35,
    ballDamage: 11,
    shots: 2,
    escorts: 1,
    reward: 2500,
  },
  {
    name: 'Gold Dread Admiral',
    color: '#ffd24a',
    health: 24,
    scale: 1.4,
    speed: 23,
    fireInterval: 1.05,
    ballDamage: 13,
    shots: 3,
    escorts: 2,
    reward: 5000,
  },
]

interface Boss {
  group: THREE.Group
  pos: THREE.Vector3
  yaw: number
  roll: number
  health: number
  maxHealth: number
  level: number
  fireTimer: number
  radius: number
  config: BossLevel
}

interface PlanetView {
  data: Planet
  group: THREE.Group
  core: THREE.Mesh
  halo: THREE.Mesh
  ring: THREE.Mesh
  label: THREE.Sprite
  coreMat: THREE.MeshStandardMaterial
  haloMat: THREE.MeshBasicMaterial
  baseColor: THREE.Color
  discovered: boolean
  hover: number // 0..1 eased hover highlight
  pulse: number // 0..1 celebratory scale pop on discovery
}

export class VoyageEngine {
  private canvas: HTMLCanvasElement
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private clock: THREE.Clock
  private frameId: number | null = null
  private disposed = false
  private paused = false

  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()

  // Ship state
  private shipGroup = new THREE.Group()
  private shipModel: THREE.Group | null = null
  private shipPos = new THREE.Vector3(0, BANDS[0].y, 0)
  private yaw = 0
  private velocity = 0
  private roll = 0
  private pitch = 0
  private targetBand = 0

  // Environment
  private starField: THREE.Points | null = null
  private nebula: THREE.Mesh | null = null
  private fog: THREE.Fog
  private ambient: THREE.AmbientLight
  private shipLight: THREE.PointLight

  // Planets
  private planetViews: PlanetView[] = []
  private planetsGroup = new THREE.Group()
  private planetMeshes: THREE.Mesh[] = []
  private hovered: PlanetView | null = null
  private completedCelebrated = false

  // Trail
  private trail: TrailParticle[] = []
  private trailGeo: THREE.BufferGeometry
  private trailMat: THREE.PointsMaterial
  private trailPoints: THREE.Points

  // Combat
  private enemies: Enemy[] = []
  private enemyGroup = new THREE.Group()
  private projectiles: Projectile[] = []
  private projectileGroup = new THREE.Group()
  private ballPool: { player: THREE.Mesh[]; enemy: THREE.Mesh[] } = {
    player: [],
    enemy: [],
  }
  private ballGeo = new THREE.SphereGeometry(0.55, 10, 10)
  private playerBallMat: THREE.MeshBasicMaterial
  private enemyBallMat: THREE.MeshBasicMaterial
  private fireTimer = 0
  private playerHealth = PLAYER_MAX_HEALTH
  private invulnUntil = 0
  private dead = false
  private respawnTimer = 0
  private flashTimer = 0 // brief hull flash when hit
  private lastDamageTime = -999 // for hull regen gating

  // Boss gauntlet
  private boss: Boss | null = null
  private gauntletActive = false
  private gauntletEnded = false
  private bossIndex = 0
  private nextBossTimer = 0

  // Explosions / sparks
  private bursts: BurstParticle[] = []
  private burstGeo: THREE.BufferGeometry
  private burstMat: THREE.PointsMaterial
  private burstPoints: THREE.Points

  // Input
  private keys = new Set<string>()
  private boundKeyDown: (e: KeyboardEvent) => void
  private boundKeyUp: (e: KeyboardEvent) => void

  // Scratch
  private camCurrent = new THREE.Vector3(0, BANDS[0].y + 12, -28)
  private tmpForward = new THREE.Vector3()
  private tmpTarget = new THREE.Vector3()
  private fogBase = new THREE.Color('#05070f')
  private fogTinted = new THREE.Color()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.clock = new THREE.Clock()

    const w = canvas.clientWidth || window.innerWidth
    const h = canvas.clientHeight || window.innerHeight

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setSize(w, h, false)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.1

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#04060e')
    this.fog = new THREE.Fog('#05070f', 120, 460)
    this.scene.fog = this.fog

    this.camera = new THREE.PerspectiveCamera(58, w / h || 1, 0.1, 2000)
    this.camera.position.copy(this.camCurrent)

    // Lighting — soft ambient so dark side of planets isn't pure black,
    // plus a travelling light attached to the ship.
    this.ambient = new THREE.AmbientLight('#8899ff', 0.55)
    this.scene.add(this.ambient)

    const key = new THREE.DirectionalLight('#fff3e0', 0.6)
    key.position.set(60, 120, 40)
    this.scene.add(key)

    this.shipLight = new THREE.PointLight('#bfe9ff', 2.2, 80, 2)
    this.scene.add(this.shipLight)

    // Trail particle system
    const trailPositions = new Float32Array(TRAIL_MAX * 3)
    const trailColors = new Float32Array(TRAIL_MAX * 3)
    const trailSizes = new Float32Array(TRAIL_MAX)
    this.trailGeo = new THREE.BufferGeometry()
    this.trailGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(trailPositions, 3),
    )
    this.trailGeo.setAttribute(
      'color',
      new THREE.BufferAttribute(trailColors, 3),
    )
    this.trailGeo.setAttribute('size', new THREE.BufferAttribute(trailSizes, 1))
    this.trailMat = new THREE.PointsMaterial({
      size: 1.4,
      transparent: true,
      opacity: 0.9,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      map: makeSoftCircleTexture(),
    })
    this.trailPoints = new THREE.Points(this.trailGeo, this.trailMat)
    this.trailPoints.frustumCulled = false
    this.scene.add(this.trailPoints)

    // Cannonball materials (shared) + projectile container.
    this.playerBallMat = new THREE.MeshBasicMaterial({ color: '#ffd27a' })
    this.enemyBallMat = new THREE.MeshBasicMaterial({ color: '#ff5a4d' })
    this.scene.add(this.projectileGroup)
    this.scene.add(this.enemyGroup)

    // Explosion / spark particle system.
    const burstPositions = new Float32Array(BURST_MAX * 3)
    const burstColors = new Float32Array(BURST_MAX * 3)
    const burstSizes = new Float32Array(BURST_MAX)
    this.burstGeo = new THREE.BufferGeometry()
    this.burstGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(burstPositions, 3),
    )
    this.burstGeo.setAttribute(
      'color',
      new THREE.BufferAttribute(burstColors, 3),
    )
    this.burstGeo.setAttribute('size', new THREE.BufferAttribute(burstSizes, 1))
    this.burstMat = new THREE.PointsMaterial({
      size: 2.4,
      transparent: true,
      opacity: 1,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      map: makeSoftCircleTexture(),
    })
    this.burstPoints = new THREE.Points(this.burstGeo, this.burstMat)
    this.burstPoints.frustumCulled = false
    this.scene.add(this.burstPoints)

    this.boundKeyDown = this.handleKeyDown.bind(this)
    this.boundKeyUp = this.handleKeyUp.bind(this)
  }

  async init(): Promise<void> {
    try {
      await modelLoader.load('/models/ship.glb')
    } catch (err) {
      console.error('[VoyageEngine] Failed to load ship model:', err)
    }

    this.buildStarfield()
    this.buildNebula()
    this.buildPlanets()
    this.buildShip()
    this.buildEnemies()

    this.scene.add(this.planetsGroup)
    this.scene.add(this.shipGroup)

    window.addEventListener('keydown', this.boundKeyDown)
    window.addEventListener('keyup', this.boundKeyUp)
    document.addEventListener('visibilitychange', this.handleVisibility)
    this.canvas.addEventListener('click', this.handleClick)
    this.canvas.addEventListener('pointermove', this.handlePointerMove)

    // Seed HUD state
    useVoyageStore.getState().setBand(0, 0)
  }

  // -------------------------------------------------------------------------
  // World construction
  // -------------------------------------------------------------------------
  private buildStarfield(): void {
    const positions = new Float32Array(STAR_COUNT * 3)
    const colors = new Float32Array(STAR_COUNT * 3)
    const palette = [
      new THREE.Color('#ffffff'),
      new THREE.Color('#bcd4ff'),
      new THREE.Color('#ffe6c2'),
      new THREE.Color('#d9c2ff'),
    ]
    for (let i = 0; i < STAR_COUNT; i++) {
      // Distribute in a big shell around the play space.
      const r = 280 + Math.pow(seeded(i * 1.7), 0.5) * 520
      const theta = seeded(i * 2.3) * Math.PI * 2
      const phi = Math.acos(2 * seeded(i * 3.1) - 1)
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.cos(phi) * 0.6 + 80
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
      const c = palette[Math.floor(seeded(i * 5.9) * palette.length)]
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const mat = new THREE.PointsMaterial({
      size: 2.2,
      sizeAttenuation: true,
      transparent: true,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      map: makeSoftCircleTexture(),
    })
    this.starField = new THREE.Points(geo, mat)
    this.starField.frustumCulled = false
    this.scene.add(this.starField)
  }

  private buildNebula(): void {
    // Large inward-facing sphere with a vertical color gradient baked into
    // vertex colors — cheap "deep space" backdrop.
    const geo = new THREE.SphereGeometry(900, 32, 32)
    const top = new THREE.Color('#1a0b3a')
    const mid = new THREE.Color('#0a1240')
    const bottom = new THREE.Color('#02030a')
    const pos = geo.attributes.position as THREE.BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) / 900 + 1) / 2 // 0 bottom .. 1 top
      if (t > 0.5) {
        c.copy(mid).lerp(top, (t - 0.5) * 2)
      } else {
        c.copy(bottom).lerp(mid, t * 2)
      }
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    })
    this.nebula = new THREE.Mesh(geo, mat)
    this.scene.add(this.nebula)
  }

  private buildPlanets(): void {
    for (const data of PLANETS) {
      const group = new THREE.Group()
      group.position.set(...data.position)

      const baseColor = new THREE.Color(data.color)

      // Core sphere — starts dim/uncharted, lights up on discovery.
      const coreMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#2b3344'),
        emissive: new THREE.Color('#0c1018'),
        emissiveIntensity: 0.4,
        roughness: 0.65,
        metalness: 0.1,
      })
      const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(data.radius, 3),
        coreMat,
      )
      core.userData.planetId = data.id
      group.add(core)
      this.planetMeshes.push(core)

      // Atmosphere halo (additive backside shell).
      const haloMat = new THREE.MeshBasicMaterial({
        color: baseColor.clone(),
        transparent: true,
        opacity: 0.0,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(data.radius * 1.35, 24, 24),
        haloMat,
      )
      group.add(halo)

      // Tilted ring.
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(data.radius * 1.9, data.radius * 0.09, 12, 64),
        new THREE.MeshBasicMaterial({
          color: baseColor.clone(),
          transparent: true,
          opacity: 0.0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      ring.rotation.x = Math.PI / 2.4
      ring.rotation.y = data.position[0] * 0.05
      group.add(ring)

      // Floating label.
      const label = makeLabelSprite(data.shortName, data.color)
      label.position.set(0, data.radius + 5, 0)
      label.visible = false
      group.add(label)

      this.planetsGroup.add(group)
      this.planetViews.push({
        data,
        group,
        core,
        halo,
        ring,
        label,
        coreMat,
        haloMat,
        baseColor,
        discovered: false,
        hover: 0,
        pulse: 0,
      })
    }
  }

  private buildShip(): void {
    if (modelLoader.isLoaded('/models/ship.glb')) {
      const tint = new THREE.Color('#ffe8cc')
      this.shipModel = modelLoader.clone('/models/ship.glb', tint)
      this.shipModel.scale.setScalar(0.5)
      this.shipGroup.add(this.shipModel)
    } else {
      // Fallback primitive so the page still works if the model fails.
      const hull = new THREE.Mesh(
        new THREE.ConeGeometry(0.8, 3, 8),
        new THREE.MeshStandardMaterial({ color: '#c8a878' }),
      )
      hull.rotation.x = Math.PI / 2
      this.shipGroup.add(hull)
    }
    this.shipGroup.position.copy(this.shipPos)
  }

  private makeEnemyModel(): THREE.Group {
    const group = new THREE.Group()
    if (modelLoader.isLoaded('/models/ship.glb')) {
      // Dark, blood-red tinted galleon — clearly a marauder.
      const model = modelLoader.clone(
        '/models/ship.glb',
        new THREE.Color('#7a2230'),
      )
      model.scale.setScalar(0.46)
      group.add(model)
    } else {
      const hull = new THREE.Mesh(
        new THREE.ConeGeometry(0.8, 3, 8),
        new THREE.MeshStandardMaterial({ color: '#7a2230' }),
      )
      hull.rotation.x = Math.PI / 2
      group.add(hull)
    }
    // Menacing red running light so pirates are visible at distance.
    const lamp = new THREE.PointLight('#ff5a4d', 1.4, 26, 2)
    lamp.position.set(0, 2, 0)
    group.add(lamp)
    return group
  }

  private buildEnemies(): void {
    for (let i = 0; i < ENEMY_COUNT; i++) {
      const group = this.makeEnemyModel()
      this.enemyGroup.add(group)
      const enemy: Enemy = {
        group,
        pos: new THREE.Vector3(),
        yaw: 0,
        roll: 0,
        bandY: 0,
        health: ENEMY_MAX_HEALTH,
        alive: true,
        fireTimer: 1 + seeded(i * 9.3) * ENEMY_FIRE_INTERVAL,
        respawnTimer: 0,
        wanderSeed: seeded(i * 3.7) * 100,
      }
      this.spawnEnemy(enemy, i)
      this.enemies.push(enemy)
    }
  }

  /** Place a pirate near a random planet (so they guard the worlds). */
  private spawnEnemy(enemy: Enemy, i: number): void {
    // Re-roll a few times so pirates don't spawn on top of the player or
    // right at the world centre (the player's spawn / respawn point).
    let x = 0
    let z = 0
    let band = BANDS[0]
    for (let attempt = 0; attempt < 6; attempt++) {
      const seed = enemy.wanderSeed + i * 1.13 + attempt * 0.37
      const planet = PLANETS[Math.floor(seeded(seed * 2.1) * PLANETS.length)]
      band = BANDS[planet.band]
      const angle = seeded(seed * 4.7) * Math.PI * 2
      const dist = 18 + seeded(seed * 6.3) * 26
      x = planet.position[0] + Math.cos(angle) * dist
      z = planet.position[2] + Math.sin(angle) * dist
      const fromCenter = Math.hypot(x, z)
      const fromPlayer = Math.hypot(x - this.shipPos.x, z - this.shipPos.z)
      if (fromCenter > 50 && fromPlayer > 45) break
    }
    // Ensure a minimum standoff from the world centre regardless.
    const r = Math.hypot(x, z)
    if (r < 55) {
      const a = Math.atan2(z, x)
      x = Math.cos(a) * 60
      z = Math.sin(a) * 60
    }
    enemy.bandY = band.y
    enemy.pos.set(x, band.y, z)
    enemy.yaw = seeded(enemy.wanderSeed * 8.9 + i) * Math.PI * 2
    enemy.health = ENEMY_MAX_HEALTH
    enemy.alive = true
    enemy.group.visible = true
    enemy.group.position.copy(enemy.pos)
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------
  private handleKeyDown(e: KeyboardEvent): void {
    const code = e.code
    if (
      [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Space',
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
        'KeyQ',
        'KeyE',
        'PageUp',
        'PageDown',
      ].includes(code)
    ) {
      e.preventDefault()
    }
    if (e.repeat) return
    this.keys.add(code)

    // Discrete altitude-band changes (climb / dive). Space is reserved for
    // firing the cannons (handled each frame while held).
    if (code === 'KeyE' || code === 'PageUp') {
      this.changeBand(1)
    } else if (code === 'KeyQ' || code === 'PageDown') {
      this.changeBand(-1)
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.code)
  }

  /** Public hook so on-screen touch buttons can drive band changes. */
  changeBand(dir: number): void {
    this.targetBand = THREE.MathUtils.clamp(
      this.targetBand + dir,
      0,
      BANDS.length - 1,
    )
  }

  /** Public hook so touch controls can set continuous input. */
  setKey(code: string, pressed: boolean): void {
    if (pressed) this.keys.add(code)
    else this.keys.delete(code)
  }

  private handleVisibility = (): void => {
    this.paused = document.hidden
    if (!document.hidden) this.clock.getDelta()
  }

  private handleClick = (event: MouseEvent): void => {
    const view = this.raycastPlanet(event.clientX, event.clientY)
    if (view) {
      window.location.assign(view.data.url)
    }
  }

  private handlePointerMove = (event: PointerEvent): void => {
    const view = this.raycastPlanet(event.clientX, event.clientY)
    this.canvas.style.cursor = view ? 'pointer' : 'auto'
    this.hovered = view
  }

  private raycastPlanet(clientX: number, clientY: number): PlanetView | null {
    const rect = this.canvas.getBoundingClientRect()
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects(this.planetMeshes, false)
    if (hits.length === 0) return null
    const id = hits[0].object.userData.planetId
    return this.planetViews.find((v) => v.data.id === id) ?? null
  }

  // -------------------------------------------------------------------------
  // Loop
  // -------------------------------------------------------------------------
  start(): void {
    this.clock.start()
    // Brief grace period so the player isn't ambushed before they get oriented.
    this.invulnUntil = this.clock.getElapsedTime() + 3.5
    this.loop()
  }

  stop(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId)
      this.frameId = null
    }
  }

  private loop = (): void => {
    if (this.disposed) return
    this.frameId = requestAnimationFrame(this.loop)
    if (this.paused) return
    const delta = Math.min(this.clock.getDelta(), 0.05)
    const time = this.clock.getElapsedTime()
    this.update(delta, time)
    this.renderer.render(this.scene, this.camera)
  }

  private update(delta: number, time: number): void {
    this.updateShip(delta)
    this.updateCamera(delta)
    this.updateTrail(time)
    this.updatePlanets(delta, time)
    this.updateCombat(delta)
    this.updateBursts(delta)
    this.updateEnvironment(delta)
  }

  private updateShip(delta: number): void {
    const k = this.keys
    // No control input while shipwrecked (drifts to a stop, then respawns).
    const ctl = !this.dead
    const forward = ctl && (k.has('ArrowUp') || k.has('KeyW'))
    const back = ctl && (k.has('ArrowDown') || k.has('KeyS'))
    const left = ctl && (k.has('ArrowLeft') || k.has('KeyA'))
    const right = ctl && (k.has('ArrowRight') || k.has('KeyD'))

    // Yaw
    let turnInput = 0
    if (left) turnInput += 1
    if (right) turnInput -= 1
    this.yaw += turnInput * TURN_SPEED * delta

    // Thrust
    if (forward) {
      this.velocity = Math.min(this.velocity + THRUST_ACCEL * delta, MAX_SPEED)
    } else if (back) {
      this.velocity = Math.max(
        this.velocity - THRUST_ACCEL * delta,
        -REVERSE_SPEED,
      )
    } else {
      // Exponential drag toward zero.
      this.velocity *= Math.exp(-1.4 * delta)
      if (Math.abs(this.velocity) < 0.02) this.velocity = 0
    }

    // Translate along heading (yaw 0 => +Z, matching the boat convention).
    this.shipPos.x += Math.sin(this.yaw) * this.velocity * delta
    this.shipPos.z += Math.cos(this.yaw) * this.velocity * delta

    // Keep inside a circular world boundary.
    const radial = Math.hypot(this.shipPos.x, this.shipPos.z)
    if (radial > WORLD_RADIUS) {
      const s = WORLD_RADIUS / radial
      this.shipPos.x *= s
      this.shipPos.z *= s
      this.velocity *= 0.9
    }

    // Smoothly settle to the target altitude band.
    const targetY = BANDS[this.targetBand].y
    const ease = 1 - Math.exp(-2.6 * delta)
    const prevY = this.shipPos.y
    this.shipPos.y += (targetY - this.shipPos.y) * ease
    const climbRate = (this.shipPos.y - prevY) / Math.max(delta, 0.0001)

    // Banking on turns + nose pitch on climb/dive + gentle idle bob.
    const targetRoll = -turnInput * 0.35
    this.roll += (targetRoll - this.roll) * (1 - Math.exp(-6 * delta))
    const targetPitch = THREE.MathUtils.clamp(-climbRate * 0.012, -0.4, 0.4)
    this.pitch += (targetPitch - this.pitch) * (1 - Math.exp(-5 * delta))

    const bob = Math.sin(this.clock.getElapsedTime() * 1.4) * 0.25

    this.shipGroup.position.set(
      this.shipPos.x,
      this.shipPos.y + bob,
      this.shipPos.z,
    )
    this.shipGroup.rotation.set(this.pitch, this.yaw, this.roll)

    this.shipLight.position.set(
      this.shipPos.x,
      this.shipPos.y + 3,
      this.shipPos.z,
    )

    // Sync band index for the HUD (closest band + smooth altitude 0..n-1).
    const span = BANDS[BANDS.length - 1].y - BANDS[0].y || 1
    const altNorm = ((this.shipPos.y - BANDS[0].y) / span) * (BANDS.length - 1)
    const nearestBand = Math.round(
      THREE.MathUtils.clamp(altNorm, 0, BANDS.length - 1),
    )
    useVoyageStore
      .getState()
      .setBand(nearestBand, Math.round(altNorm * 100) / 100)
  }

  private updateCamera(delta: number): void {
    // Heading-relative chase camera.
    this.tmpForward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw))
    this.tmpTarget.copy(this.shipPos).addScaledVector(this.tmpForward, -26)
    this.tmpTarget.y += 12

    const ease = 1 - Math.exp(-4 * delta)
    this.camCurrent.lerp(this.tmpTarget, ease)
    this.camera.position.copy(this.camCurrent)

    this.tmpTarget.copy(this.shipPos).addScaledVector(this.tmpForward, 10)
    this.tmpTarget.y += 2
    this.camera.lookAt(this.tmpTarget)
  }

  private updateTrail(time: number): void {
    const now = time * 1000
    // Spawn from behind the ship while moving.
    if (Math.abs(this.velocity) > 2) {
      const band = BANDS[this.targetBand]
      const color = new THREE.Color(band.color)
      const spawn = Math.min(3, Math.ceil(Math.abs(this.velocity) / 12))
      for (let s = 0; s < spawn; s++) {
        const back = 1.6 + Math.random() * 1.2
        const spread = (Math.random() - 0.5) * 1.4
        this.trail.push({
          x:
            this.shipPos.x -
            Math.sin(this.yaw) * back +
            Math.cos(this.yaw) * spread,
          y: this.shipPos.y + (Math.random() - 0.5) * 0.8,
          z:
            this.shipPos.z -
            Math.cos(this.yaw) * back -
            Math.sin(this.yaw) * spread,
          birth: now,
          life: 900 + Math.random() * 700,
          size: 0.8 + Math.random() * 1.4,
          color,
        })
      }
    }

    this.trail = this.trail.filter((p) => now - p.birth < p.life)

    const positions = this.trailGeo.attributes.position as THREE.BufferAttribute
    const colors = this.trailGeo.attributes.color as THREE.BufferAttribute
    const sizes = this.trailGeo.attributes.size as THREE.BufferAttribute
    const count = Math.min(this.trail.length, TRAIL_MAX)
    for (let i = 0; i < count; i++) {
      const p = this.trail[i]
      const age = (now - p.birth) / p.life
      const fade = 1 - age
      positions.setXYZ(i, p.x, p.y, p.z)
      colors.setXYZ(i, p.color.r * fade, p.color.g * fade, p.color.b * fade)
      sizes.setX(i, p.size * fade)
    }
    this.trailGeo.setDrawRange(0, count)
    positions.needsUpdate = true
    colors.needsUpdate = true
    sizes.needsUpdate = true
  }

  private updatePlanets(delta: number, time: number): void {
    const store = useVoyageStore.getState()
    let nearest: PlanetView | null = null
    let nearestDist = Infinity

    for (const v of this.planetViews) {
      // Idle spin + float.
      v.core.rotation.y += delta * 0.25
      v.ring.rotation.z += delta * 0.15
      v.group.position.y =
        v.data.position[1] + Math.sin(time * 0.6 + v.data.position[0]) * 0.8

      const dist = this.shipPos.distanceTo(v.group.position)
      const visitDist = v.data.radius + VISIT_RANGE

      // Discovery: first time within visit range — reward the captain.
      if (dist < visitDist && !v.discovered) {
        v.discovered = true
        v.label.visible = true
        v.pulse = 1
        store.discover(v.data)
        // Celebratory firework at the newly charted world.
        this.spawnBurst(v.group.position, v.baseColor.clone(), 54, 24)
        this.spawnBurst(v.group.position, new THREE.Color('#ffe6a8'), 30, 16)
        if (
          useVoyageStore.getState().discoveredCount >=
            this.planetViews.length &&
          !this.completedCelebrated
        ) {
          this.completedCelebrated = true
          this.celebrateCompletion()
        }
      }

      // Light up discovered planets in brand color.
      if (v.discovered) {
        v.coreMat.color.lerp(v.baseColor, 1 - Math.exp(-3 * delta))
        v.coreMat.emissive.lerp(v.baseColor, 1 - Math.exp(-3 * delta))
        v.coreMat.emissiveIntensity = THREE.MathUtils.lerp(
          v.coreMat.emissiveIntensity,
          0.85,
          1 - Math.exp(-3 * delta),
        )
        v.haloMat.opacity = THREE.MathUtils.lerp(
          v.haloMat.opacity,
          0.32,
          1 - Math.exp(-3 * delta),
        )
        const ringMat = v.ring.material as THREE.MeshBasicMaterial
        ringMat.opacity = THREE.MathUtils.lerp(
          ringMat.opacity,
          0.5,
          1 - Math.exp(-3 * delta),
        )
      }

      // Hover highlight + celebratory discovery pop.
      const targetHover = this.hovered === v ? 1 : 0
      v.hover += (targetHover - v.hover) * (1 - Math.exp(-8 * delta))
      v.pulse = Math.max(0, v.pulse - delta * 1.6)
      const pop = Math.sin(v.pulse * Math.PI) * 0.4
      const scale = 1 + v.hover * 0.12 + pop
      v.group.scale.setScalar(scale)

      if (dist < visitDist + 6 && dist < nearestDist) {
        nearest = v
        nearestDist = dist
      }
    }

    // Update "nearby" HUD target.
    if (nearest) {
      store.setNearby({
        id: nearest.data.id,
        name: nearest.data.name,
        shortName: nearest.data.shortName,
        tagline: nearest.data.tagline,
        url: nearest.data.url,
        color: nearest.data.color,
      })
    } else {
      store.setNearby(null)
    }
  }

  // -------------------------------------------------------------------------
  // Combat
  // -------------------------------------------------------------------------
  private updateCombat(delta: number): void {
    const now = this.clock.getElapsedTime()
    const invuln = now < this.invulnUntil

    // Hull-hit light flash decay.
    if (this.flashTimer > 0) {
      this.flashTimer -= delta
      this.shipLight.color.setRGB(1, 0.4, 0.3)
    } else {
      this.shipLight.color.set('#bfe9ff')
    }

    // Post-respawn invulnerability blink.
    this.shipGroup.visible = invuln ? Math.floor(now * 12) % 2 === 0 : true

    // Player respawn countdown.
    if (this.dead) {
      this.respawnTimer -= delta
      if (this.respawnTimer <= 0) this.respawnPlayer()
    }

    // Player firing (hold Space / fire button).
    this.fireTimer = Math.max(0, this.fireTimer - delta)
    if (!this.dead && this.keys.has('Space') && this.fireTimer <= 0) {
      this.firePlayer()
      this.fireTimer = PLAYER_FIRE_INTERVAL
    }

    // Slow hull self-repair once you've been out of the fight for a moment.
    if (
      !this.dead &&
      this.playerHealth < PLAYER_MAX_HEALTH &&
      now - this.lastDamageTime > REGEN_DELAY
    ) {
      this.playerHealth = Math.min(
        PLAYER_MAX_HEALTH,
        this.playerHealth + HULL_REGEN * delta,
      )
      useVoyageStore.getState().setHealth(Math.ceil(this.playerHealth))
    }

    this.updateEnemies(delta, now, invuln)

    // Boss gauntlet pacing.
    if (this.boss) {
      this.updateBoss(delta, invuln)
    } else if (this.gauntletActive && this.nextBossTimer > 0) {
      this.nextBossTimer -= delta
      if (this.nextBossTimer <= 0) this.spawnBoss(this.bossIndex)
    }

    this.updateProjectiles(delta, now, invuln)
  }

  private updateEnemies(delta: number, now: number, invuln: boolean): void {
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]

      if (!e.alive) {
        e.respawnTimer -= delta
        if (e.respawnTimer <= 0) this.spawnEnemy(e, i)
        continue
      }

      const dx = this.shipPos.x - e.pos.x
      const dz = this.shipPos.z - e.pos.z
      const dy = this.shipPos.y - e.bandY
      const distXZ = Math.hypot(dx, dz)
      const dist3D = Math.hypot(distXZ, this.shipPos.y - e.pos.y)
      const sameBand = Math.abs(dy) < ENEMY_BAND_TOLERANCE
      const aggro = !this.dead && sameBand && dist3D < ENEMY_AGGRO

      let turnDir = 0
      if (aggro) {
        // Face and close on the player.
        const desiredYaw = Math.atan2(dx, dz)
        const diff = wrapAngle(desiredYaw - e.yaw)
        turnDir = Math.sign(diff)
        e.yaw += THREE.MathUtils.clamp(diff, -2.2 * delta, 2.2 * delta)
        // Hold a firing distance rather than ramming through.
        const speed =
          distXZ > 28 ? ENEMY_SPEED : distXZ < 18 ? -ENEMY_SPEED * 0.4 : 0
        e.pos.x += Math.sin(e.yaw) * speed * delta
        e.pos.z += Math.cos(e.yaw) * speed * delta

        e.fireTimer -= delta
        if (e.fireTimer <= 0 && dist3D < ENEMY_FIRE_RANGE && !invuln) {
          this.fireEnemy(e)
          e.fireTimer = ENEMY_FIRE_INTERVAL * (0.8 + seeded(now + i) * 0.5)
        }
      } else {
        // Lazy patrol drift.
        e.yaw += Math.sin(now * 0.3 + e.wanderSeed) * 0.4 * delta
        const speed = ENEMY_SPEED * 0.35
        e.pos.x += Math.sin(e.yaw) * speed * delta
        e.pos.z += Math.cos(e.yaw) * speed * delta
      }

      // Steer back toward the play area near the boundary.
      const radial = Math.hypot(e.pos.x, e.pos.z)
      if (radial > WORLD_RADIUS - 6) {
        const inward = Math.atan2(-e.pos.x, -e.pos.z)
        e.yaw += wrapAngle(inward - e.yaw) * Math.min(1, 3 * delta)
        const s = (WORLD_RADIUS - 6) / radial
        e.pos.x *= s
        e.pos.z *= s
      }

      // Settle to band altitude with a gentle bob.
      const targetY = e.bandY + Math.sin(now * 0.8 + e.wanderSeed) * 0.8
      e.pos.y += (targetY - e.pos.y) * (1 - Math.exp(-3 * delta))

      // Banking.
      const targetRoll = -turnDir * 0.28
      e.roll += (targetRoll - e.roll) * (1 - Math.exp(-5 * delta))

      // Ramming the player hull hurts (and shoves both apart).
      if (!this.dead && !invuln && dist3D < PLAYER_RADIUS + 3) {
        this.damagePlayer(COLLISION_DAMAGE * delta * 2.2)
        const push = (PLAYER_RADIUS + 3 - dist3D) * 0.5
        e.pos.x -= (dx / (dist3D || 1)) * push
        e.pos.z -= (dz / (dist3D || 1)) * push
      }

      e.group.position.copy(e.pos)
      e.group.rotation.set(0, e.yaw, e.roll)
    }
  }

  private updateProjectiles(delta: number, now: number, invuln: boolean): void {
    const survivors: Projectile[] = []
    for (const p of this.projectiles) {
      p.pos.addScaledVector(p.vel, delta)
      p.life -= delta
      let dead = p.life <= 0 || Math.hypot(p.pos.x, p.pos.z) > WORLD_RADIUS + 70

      if (!dead && p.fromPlayer) {
        for (const e of this.enemies) {
          if (!e.alive) continue
          if (p.pos.distanceTo(e.pos) < ENEMY_RADIUS) {
            e.health -= p.damage
            this.spawnBurst(p.pos, new THREE.Color('#ffd27a'), 10, 14)
            if (e.health <= 0) this.destroyEnemy(e)
            dead = true
            break
          }
        }
        // Player cannonballs also wound the boss.
        if (
          !dead &&
          this.boss &&
          p.pos.distanceTo(this.boss.pos) < this.boss.radius
        ) {
          this.boss.health -= p.damage
          this.spawnBurst(
            p.pos,
            new THREE.Color(this.boss.config.color),
            14,
            16,
          )
          useVoyageStore.getState().setBossHp(Math.max(0, this.boss.health))
          if (this.boss.health <= 0) this.defeatBoss()
          dead = true
        }
      } else if (!dead && !p.fromPlayer && !this.dead && !invuln) {
        if (p.pos.distanceTo(this.shipPos) < PLAYER_RADIUS) {
          this.damagePlayer(p.damage)
          this.spawnBurst(p.pos, new THREE.Color('#ff7a4d'), 10, 14)
          dead = true
        }
      }

      if (dead) {
        this.releaseBall(p.mesh, p.fromPlayer)
      } else {
        p.mesh.position.copy(p.pos)
        survivors.push(p)
      }
    }
    this.projectiles = survivors
  }

  private firePlayer(): void {
    const fx = Math.sin(this.yaw)
    const fz = Math.cos(this.yaw)
    const bow = new THREE.Vector3(
      this.shipPos.x + fx * 2.6,
      this.shipPos.y + 0.4,
      this.shipPos.z + fz * 2.6,
    )
    const vel = new THREE.Vector3(fx, 0, fz).multiplyScalar(PLAYER_BALL_SPEED)
    this.spawnBall(bow, vel, true, PLAYER_BALL_LIFE, PLAYER_BALL_DAMAGE)
    this.spawnBurst(bow, new THREE.Color('#ffe6a8'), 6, 9)
  }

  private fireEnemy(e: Enemy): void {
    // Lead the target a little based on travel time.
    const toPlayer = new THREE.Vector3().subVectors(this.shipPos, e.pos)
    const travel = toPlayer.length() / ENEMY_BALL_SPEED
    const lead = new THREE.Vector3(
      Math.sin(this.yaw) * this.velocity,
      0,
      Math.cos(this.yaw) * this.velocity,
    ).multiplyScalar(travel)
    const dir = toPlayer.add(lead).normalize()
    // A little inaccuracy so it's dodgeable.
    dir.x += (seeded(e.wanderSeed + e.pos.x) - 0.5) * 0.08
    dir.y += (seeded(e.wanderSeed + e.pos.z) - 0.5) * 0.05
    dir.normalize()
    const muzzle = new THREE.Vector3().copy(e.pos).addScaledVector(dir, 2.6)
    const vel = dir.multiplyScalar(ENEMY_BALL_SPEED)
    this.spawnBall(muzzle, vel, false, ENEMY_BALL_LIFE, ENEMY_BALL_DAMAGE)
    this.spawnBurst(muzzle, new THREE.Color('#ff5a4d'), 5, 8)
  }

  private spawnBall(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    fromPlayer: boolean,
    life: number,
    damage: number,
  ): void {
    const mesh = this.acquireBall(fromPlayer)
    mesh.position.copy(pos)
    this.projectiles.push({
      pos: pos.clone(),
      vel,
      life,
      fromPlayer,
      damage,
      mesh,
    })
  }

  private acquireBall(fromPlayer: boolean): THREE.Mesh {
    const pool = fromPlayer ? this.ballPool.player : this.ballPool.enemy
    let mesh = pool.pop()
    if (!mesh) {
      mesh = new THREE.Mesh(
        this.ballGeo,
        fromPlayer ? this.playerBallMat : this.enemyBallMat,
      )
    }
    mesh.visible = true
    this.projectileGroup.add(mesh)
    return mesh
  }

  private releaseBall(mesh: THREE.Mesh, fromPlayer: boolean): void {
    this.projectileGroup.remove(mesh)
    ;(fromPlayer ? this.ballPool.player : this.ballPool.enemy).push(mesh)
  }

  private destroyEnemy(e: Enemy): void {
    e.alive = false
    e.group.visible = false
    e.respawnTimer = ENEMY_RESPAWN_DELAY
    this.spawnBurst(e.pos, new THREE.Color('#ff8a3d'), 60, 26)
    this.spawnBurst(e.pos, new THREE.Color('#ffd27a'), 30, 16)
    useVoyageStore.getState().addPirateSunk()
  }

  // -------------------------------------------------------------------------
  // Boss gauntlet
  // -------------------------------------------------------------------------
  /** Kick off the end-game gauntlet (called from the victory screen). */
  startGauntlet(): void {
    if (this.gauntletActive || this.gauntletEnded || this.boss) return
    this.gauntletActive = true
    this.bossIndex = 0
    useVoyageStore.getState().setGauntletActive(true)
    // Clear the roaming pirates for a focused duel.
    for (const e of this.enemies) {
      e.alive = false
      e.group.visible = false
      e.respawnTimer = 1e9
    }
    this.projectiles = this.projectiles.filter((p) => {
      if (p.fromPlayer) return true
      this.releaseBall(p.mesh, false)
      return false
    })
    this.spawnBoss(0)
  }

  private spawnBoss(index: number): void {
    const cfg = BOSS_LEVELS[index]
    const group = new THREE.Group()
    if (modelLoader.isLoaded('/models/ship.glb')) {
      const model = modelLoader.clone(
        '/models/ship.glb',
        new THREE.Color(cfg.color),
      )
      model.scale.setScalar(0.7 * cfg.scale)
      group.add(model)
    } else {
      const hull = new THREE.Mesh(
        new THREE.ConeGeometry(1.4, 4, 8),
        new THREE.MeshStandardMaterial({ color: cfg.color }),
      )
      hull.rotation.x = Math.PI / 2
      group.add(hull)
    }
    const lamp = new THREE.PointLight(new THREE.Color(cfg.color), 2.6, 46, 2)
    lamp.position.set(0, 3, 0)
    group.add(lamp)

    // Spawn ahead of the player in their current band.
    const ahead = 72
    const pos = new THREE.Vector3(
      this.shipPos.x + Math.sin(this.yaw) * ahead,
      this.shipPos.y,
      this.shipPos.z + Math.cos(this.yaw) * ahead,
    )
    const r = Math.hypot(pos.x, pos.z)
    if (r > WORLD_RADIUS - 10) {
      const s = (WORLD_RADIUS - 10) / r
      pos.x *= s
      pos.z *= s
    }
    group.position.copy(pos)
    this.scene.add(group)

    this.boss = {
      group,
      pos,
      yaw: this.yaw + Math.PI,
      roll: 0,
      health: cfg.health,
      maxHealth: cfg.health,
      level: index + 1,
      fireTimer: 2.2,
      radius: 5 * cfg.scale,
      config: cfg,
    }
    useVoyageStore.getState().setBoss({
      name: cfg.name,
      color: cfg.color,
      level: index + 1,
      total: BOSS_LEVELS.length,
      maxHp: cfg.health,
    })
    this.spawnBurst(pos, new THREE.Color(cfg.color), 54, 26)

    // Reactivate a few pool pirates as escorts for the higher tiers.
    let spawned = 0
    for (const e of this.enemies) {
      if (spawned >= cfg.escorts) break
      const ang = (spawned / Math.max(1, cfg.escorts)) * Math.PI * 2
      e.bandY = this.shipPos.y
      e.pos.set(
        pos.x + Math.cos(ang) * 16,
        this.shipPos.y,
        pos.z + Math.sin(ang) * 16,
      )
      e.yaw = ang
      e.health = ENEMY_MAX_HEALTH
      e.alive = true
      e.respawnTimer = 0
      e.group.visible = true
      e.group.position.copy(e.pos)
      spawned++
    }
  }

  private updateBoss(delta: number, invuln: boolean): void {
    const b = this.boss
    if (!b) return
    const to = new THREE.Vector3().subVectors(this.shipPos, b.pos)
    const dist = to.length()

    const desiredYaw = Math.atan2(to.x, to.z)
    b.yaw += THREE.MathUtils.clamp(
      wrapAngle(desiredYaw - b.yaw),
      -2.4 * delta,
      2.4 * delta,
    )
    const speed =
      dist > 34 ? b.config.speed : dist < 20 ? -b.config.speed * 0.5 : 0
    b.pos.x += Math.sin(b.yaw) * speed * delta
    b.pos.z += Math.cos(b.yaw) * speed * delta
    // The boss hunts you across dimensions.
    b.pos.y += (this.shipPos.y - b.pos.y) * (1 - Math.exp(-2 * delta))

    const r = Math.hypot(b.pos.x, b.pos.z)
    if (r > WORLD_RADIUS - 8) {
      const s = (WORLD_RADIUS - 8) / r
      b.pos.x *= s
      b.pos.z *= s
    }

    b.fireTimer -= delta
    if (b.fireTimer <= 0 && dist < 95 && !this.dead && !invuln) {
      this.fireBoss(b, dist)
      b.fireTimer = b.config.fireInterval
    }

    if (!this.dead && !invuln && dist < PLAYER_RADIUS + b.radius) {
      this.damagePlayer(COLLISION_DAMAGE * delta * 2.5)
      const push = (PLAYER_RADIUS + b.radius - dist) * 0.5
      b.pos.x -= (to.x / (dist || 1)) * push
      b.pos.z -= (to.z / (dist || 1)) * push
    }

    b.roll = Math.sin(this.clock.getElapsedTime() * 1.5) * 0.05
    b.group.position.copy(b.pos)
    b.group.rotation.set(0, b.yaw, b.roll)
  }

  private fireBoss(b: Boss, dist: number): void {
    const base = Math.atan2(this.shipPos.x - b.pos.x, this.shipPos.z - b.pos.z)
    const dyN = THREE.MathUtils.clamp(
      (this.shipPos.y - b.pos.y) / Math.max(dist, 1),
      -0.3,
      0.3,
    )
    const spread = 0.16
    const n = b.config.shots
    for (let k = 0; k < n; k++) {
      const ang = base + (k - (n - 1) / 2) * spread
      const dir = new THREE.Vector3(
        Math.sin(ang),
        dyN,
        Math.cos(ang),
      ).normalize()
      const muzzle = new THREE.Vector3()
        .copy(b.pos)
        .addScaledVector(dir, b.radius + 1)
      this.spawnBall(
        muzzle,
        dir.clone().multiplyScalar(ENEMY_BALL_SPEED),
        false,
        ENEMY_BALL_LIFE,
        b.config.ballDamage,
      )
    }
    this.spawnBurst(b.pos, new THREE.Color(b.config.color), 8, 10)
  }

  private defeatBoss(): void {
    const b = this.boss
    if (!b) return
    this.spawnBurst(b.pos, new THREE.Color(b.config.color), 80, 30)
    this.spawnBurst(b.pos, new THREE.Color('#fff0c2'), 44, 20)
    this.scene.remove(b.group)
    this.disposeGroup(b.group)
    this.boss = null

    const store = useVoyageStore.getState()
    store.setBoss(null)
    store.addBossDefeated()
    store.addDoubloons(b.config.reward)

    this.bossIndex++
    if (this.bossIndex < BOSS_LEVELS.length) {
      this.nextBossTimer = 3.2
    } else {
      this.finishGauntlet()
    }
  }

  private finishGauntlet(): void {
    this.gauntletActive = false
    this.gauntletEnded = true
    const store = useVoyageStore.getState()
    store.setGauntletActive(false)
    store.setChampion(true)
    this.celebrateCompletion()
    // Bring back roaming pirates for continued free play.
    for (const e of this.enemies) {
      e.respawnTimer = 1 + Math.random() * 4
    }
  }

  private disposeGroup(group: THREE.Object3D): void {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose()
        const m = child.material
        if (Array.isArray(m)) m.forEach((x) => x.dispose())
        else m?.dispose()
      }
    })
  }

  private damagePlayer(amount: number): void {
    if (this.dead) return
    this.playerHealth = Math.max(0, this.playerHealth - amount)
    this.flashTimer = 0.18
    this.lastDamageTime = this.clock.getElapsedTime()
    useVoyageStore.getState().setHealth(Math.ceil(this.playerHealth))
    if (this.playerHealth <= 0) this.killPlayer()
  }

  private killPlayer(): void {
    this.dead = true
    this.playerHealth = 0
    this.velocity = 0
    this.respawnTimer = RESPAWN_DELAY
    this.spawnBurst(this.shipPos, new THREE.Color('#ff8a3d'), 90, 32)
    this.spawnBurst(this.shipPos, new THREE.Color('#fff0c2'), 40, 20)
    const store = useVoyageStore.getState()
    store.setHealth(0)
    store.setShipwrecked(true)
  }

  private respawnPlayer(): void {
    this.dead = false
    this.shipPos.set(0, BANDS[0].y, 0)
    this.targetBand = 0
    this.yaw = 0
    this.velocity = 0
    this.playerHealth = PLAYER_MAX_HEALTH
    this.invulnUntil = this.clock.getElapsedTime() + INVULN_TIME
    // Snap the camera behind the fresh spawn to avoid a wild swing.
    this.camCurrent.set(0, BANDS[0].y + 12, -26)
    // Clear any in-flight enemy cannonballs.
    this.projectiles = this.projectiles.filter((p) => {
      if (p.fromPlayer) return true
      this.releaseBall(p.mesh, false)
      return false
    })
    const store = useVoyageStore.getState()
    store.setHealth(PLAYER_MAX_HEALTH)
    store.setShipwrecked(false)
  }

  private spawnBurst(
    origin: THREE.Vector3,
    color: THREE.Color,
    count: number,
    speed: number,
  ): void {
    const now = this.clock.getElapsedTime() * 1000
    for (let i = 0; i < count; i++) {
      if (this.bursts.length >= BURST_MAX) break
      const dir = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5,
      ).normalize()
      this.bursts.push({
        pos: origin.clone(),
        vel: dir.multiplyScalar(speed * (0.4 + Math.random() * 0.6)),
        birth: now,
        life: 350 + Math.random() * 500,
        size: 1.4 + Math.random() * 2.4,
        color,
      })
    }
  }

  /** Big fireworks finale when every world has been charted. */
  private celebrateCompletion(): void {
    const colors = ['#ffd27a', '#7ad1ff', '#ff7ad1', '#9bff8a', '#fff0c2']
    const fire = (wave: number) => {
      if (this.disposed) return
      for (let i = 0; i < 5; i++) {
        const ang = Math.random() * Math.PI * 2
        const r = 12 + Math.random() * 26
        const origin = new THREE.Vector3(
          this.shipPos.x + Math.cos(ang) * r,
          this.shipPos.y + 4 + Math.random() * 14,
          this.shipPos.z + Math.sin(ang) * r,
        )
        const color = new THREE.Color(colors[(i + wave) % colors.length])
        this.spawnBurst(origin, color, 40, 22)
      }
    }
    // A few staggered volleys for a proper send-off.
    fire(0)
    for (let w = 1; w <= 5; w++) {
      setTimeout(() => fire(w), w * 450)
    }
  }

  private updateBursts(delta: number): void {
    const now = this.clock.getElapsedTime() * 1000
    const drag = Math.exp(-2.4 * delta)
    this.bursts = this.bursts.filter((b) => now - b.birth < b.life)
    const positions = this.burstGeo.attributes.position as THREE.BufferAttribute
    const colors = this.burstGeo.attributes.color as THREE.BufferAttribute
    const sizes = this.burstGeo.attributes.size as THREE.BufferAttribute
    const count = Math.min(this.bursts.length, BURST_MAX)
    for (let i = 0; i < count; i++) {
      const b = this.bursts[i]
      b.pos.addScaledVector(b.vel, delta)
      b.vel.multiplyScalar(drag)
      const fade = 1 - (now - b.birth) / b.life
      positions.setXYZ(i, b.pos.x, b.pos.y, b.pos.z)
      colors.setXYZ(i, b.color.r * fade, b.color.g * fade, b.color.b * fade)
      sizes.setX(i, b.size * fade)
    }
    this.burstGeo.setDrawRange(0, count)
    positions.needsUpdate = true
    colors.needsUpdate = true
    sizes.needsUpdate = true
  }

  private updateEnvironment(delta: number): void {
    // Slowly drift the starfield + nebula for parallax life.
    if (this.starField) this.starField.rotation.y += delta * 0.004
    if (this.nebula) this.nebula.rotation.y -= delta * 0.002

    // Tint the fog + ambient toward the current band's color so each
    // dimension feels distinct.
    const band = BANDS[this.targetBand]
    const bandColor = new THREE.Color(band.color)
    this.fogTinted.copy(this.fogBase).lerp(bandColor, 0.12)
    this.fog.color.lerp(this.fogTinted, 1 - Math.exp(-1.5 * delta))
    this.ambient.color.lerp(
      new THREE.Color('#8899ff').lerp(bandColor, 0.25),
      1 - Math.exp(-1.5 * delta),
    )
  }

  // -------------------------------------------------------------------------
  // Resize / dispose
  // -------------------------------------------------------------------------
  resize(width: number, height: number): void {
    if (width === 0 || height === 0) return
    const dpr = Math.min(window.devicePixelRatio, 2)
    this.canvas.width = width * dpr
    this.canvas.height = height * dpr
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }

  dispose(): void {
    this.disposed = true
    this.stop()

    window.removeEventListener('keydown', this.boundKeyDown)
    window.removeEventListener('keyup', this.boundKeyUp)
    document.removeEventListener('visibilitychange', this.handleVisibility)
    this.canvas.removeEventListener('click', this.handleClick)
    this.canvas.removeEventListener('pointermove', this.handlePointerMove)

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.geometry?.dispose()
        const mat = obj.material
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
        else mat?.dispose()
      }
      if (obj instanceof THREE.Sprite) {
        obj.material.map?.dispose()
        obj.material.dispose()
      }
    })

    // Shared combat resources (pooled cannonballs may not be in the scene).
    this.ballGeo.dispose()
    this.playerBallMat.dispose()
    this.enemyBallMat.dispose()
    this.burstMat.map?.dispose()

    try {
      this.renderer.dispose()
    } catch (e) {
      console.warn('[VoyageEngine] renderer dispose error:', e)
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic pseudo-random in [0,1) from a numeric seed. */
function seeded(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Wrap an angle to (-PI, PI]. */
function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}

function makeSoftCircleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.85)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(canvas)
}

function makeLabelSprite(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const font = 'bold 52px Inter, system-ui, sans-serif'
  ctx.font = font
  const padding = 36
  const textWidth = ctx.measureText(text).width
  canvas.width = Math.ceil(textWidth + padding * 2)
  canvas.height = 128

  // Pill background.
  ctx.font = font
  ctx.fillStyle = 'rgba(6, 10, 22, 0.72)'
  roundRect(ctx, 0, 28, canvas.width, 72, 36)
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = color
  roundRect(ctx, 1.5, 29.5, canvas.width - 3, 69, 34.5)
  ctx.stroke()

  // Text.
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, canvas.width / 2, 65)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  })
  const sprite = new THREE.Sprite(mat)
  const aspect = canvas.width / canvas.height
  const h = 4.4
  sprite.scale.set(h * aspect, h, 1)
  return sprite
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
