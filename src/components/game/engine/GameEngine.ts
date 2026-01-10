import * as THREE from 'three'
import { useGameStore } from '../hooks/useGameStore'
import { preloadModels } from './loaders/ModelLoader'
import { preloadGameFonts } from './loaders/FontLoader'
import { Sky } from './entities/Sky'
import { Ocean } from './entities/Ocean'
import { Boat } from './entities/Boat'
import { Coins } from './entities/Coins'
import { Islands } from './entities/Islands'
import { OceanRocks } from './entities/OceanRocks'
import { BoundaryWalls } from './entities/BoundaryWalls'
import { AIShips } from './entities/AIShips'
import { Cannonballs } from './entities/Cannonballs'
import { AIDebug } from './entities/AIDebug'

// Global engine reference for HMR
let __hmrEngine: GameEngine | null = null
import { CameraSystem } from './systems/CameraSystem'
import { BoatControlSystem } from './systems/BoatControlSystem'
import { DiscoverySystem } from './systems/DiscoverySystem'
import { CoinSystem } from './systems/CoinSystem'
import { AISystem } from './systems/AISystem'
import { CannonballSystem } from './systems/CannonballSystem'
import {
  generateIslands,
  generateExpandedIslands,
} from '../utils/islandGenerator'
import { generateRockColliders } from '../utils/collision'
import { generateCoins } from '../utils/coinGenerator'
import { libraries } from '~/libraries'
import { partners } from '~/utils/partners'

// Filter to only active partners
const ACTIVE_PARTNERS = partners
  .filter((p) => p.status === 'active')
  .map((p) => ({
    id: p.id,
    name: p.name,
    href: p.href,
    brandColor: p.brandColor,
    tagline: p.tagline,
    // Get logo URLs - prefer white/light versions for colored backgrounds
    logoLight:
      'dark' in p.image
        ? p.image.dark
        : 'src' in p.image
          ? p.image.src
          : undefined,
    logoDark:
      'light' in p.image
        ? p.image.light
        : 'src' in p.image
          ? p.image.src
          : undefined,
  }))

export class GameEngine {
  private canvas: HTMLCanvasElement
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private clock: THREE.Clock
  private animationFrameId: number | null = null
  private unsubscribers: Array<() => void> = []
  private isDisposed = false
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()

  // Entities
  private sky: Sky
  private ocean: Ocean
  private boat: Boat
  private coins: Coins
  private islands: Islands
  private oceanRocks: OceanRocks
  private boundaryWalls: BoundaryWalls
  private aiShips: AIShips
  private cannonballs: Cannonballs
  private aiDebug: AIDebug

  // Systems
  private cameraSystem: CameraSystem
  private boatControlSystem: BoatControlSystem
  private discoverySystem: DiscoverySystem
  private coinSystem: CoinSystem
  private aiSystem: AISystem
  private cannonballSystem: CannonballSystem

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.clock = new THREE.Clock()

    // Get dimensions - use clientWidth/Height for aspect ratio, canvas.width/height for resolution
    const displayWidth = canvas.clientWidth || window.innerWidth
    const displayHeight = canvas.clientHeight || window.innerHeight

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    })
    // Don't call setPixelRatio since canvas is already sized with DPR
    this.renderer.setSize(displayWidth, displayHeight, false) // false = don't update canvas style
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2

    // Create scene
    this.scene = new THREE.Scene()

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      20, // Narrow FOV for isometric feel
      displayWidth / displayHeight || 1,
      0.1,
      1000,
    )
    this.camera.position.set(22, 15, 22)
    this.camera.lookAt(0, 0, 0)

    // Create entities (will be initialized in init())
    this.sky = new Sky()
    this.ocean = new Ocean()
    this.boat = new Boat()
    this.coins = new Coins()
    this.islands = new Islands()
    this.oceanRocks = new OceanRocks()
    this.boundaryWalls = new BoundaryWalls()
    this.aiShips = new AIShips()
    this.cannonballs = new Cannonballs()
    this.aiDebug = new AIDebug()

    // Create systems
    this.cameraSystem = new CameraSystem(this.camera)
    this.boatControlSystem = new BoatControlSystem()
    this.discoverySystem = new DiscoverySystem()
    this.coinSystem = new CoinSystem()
    this.aiSystem = new AISystem()
    this.cannonballSystem = new CannonballSystem()

    // Connect debug entity to AI system
    this.aiDebug.setAISystem(this.aiSystem)

    // Handle resize
    window.addEventListener('resize', this.handleResize)

    // Handle clicks for info signs
    this.canvas.addEventListener('click', this.handleClick)
    this.canvas.addEventListener('pointermove', this.handlePointerMove)

    // Store for HMR
    __hmrEngine = this
  }

  async init(): Promise<void> {
    // Preload assets
    try {
      await Promise.all([preloadModels(), preloadGameFonts()])
    } catch (err) {
      console.error('[GameEngine] Failed to preload assets:', err)
    }

    // Setup lighting
    this.setupLighting()

    // Initialize game data
    this.initializeGameData()

    // Add entities to scene
    this.scene.add(this.sky.mesh)
    this.scene.add(this.ocean.mesh)
    this.scene.add(this.boat.group)
    this.scene.add(this.boat.getWakeMesh())
    this.scene.add(this.coins.group)
    this.scene.add(this.islands.group)
    this.scene.add(this.oceanRocks.group)
    this.scene.add(this.boundaryWalls.group)
    this.scene.add(this.aiShips.group)
    this.scene.add(this.cannonballs.group)
    this.scene.add(this.aiDebug.group)

    // Initialize boat model
    const { boatType } = useGameStore.getState()
    this.boat.setBoatType(boatType)

    // Setup subscriptions
    this.setupSubscriptions()

    // Initialize systems
    this.boatControlSystem.init()
  }

  private setupLighting(): void {
    // Ambient light
    const ambient = new THREE.AmbientLight('#FFF8E7', 0.5)
    this.scene.add(ambient)

    // Main directional light
    const directional = new THREE.DirectionalLight('#FFF5E0', 1.3)
    directional.position.set(50, 100, 50)
    directional.castShadow = true
    directional.shadow.mapSize.set(2048, 2048)
    directional.shadow.camera.far = 250
    directional.shadow.camera.left = -100
    directional.shadow.camera.right = 100
    directional.shadow.camera.top = 100
    directional.shadow.camera.bottom = -100
    directional.shadow.bias = -0.0001
    directional.shadow.normalBias = 0.04
    this.scene.add(directional)

    // Fill light
    const fill = new THREE.DirectionalLight('#87CEEB', 0.4)
    fill.position.set(-30, 40, -30)
    this.scene.add(fill)

    // Hemisphere light
    const hemi = new THREE.HemisphereLight('#87CEEB', '#8B4513', 0.5)
    this.scene.add(hemi)
  }

  private initializeGameData(): void {
    const state = useGameStore.getState()

    if (state.islands.length === 0) {
      // Generate islands
      const generatedIslands = generateIslands(libraries)
      state.setIslands(generatedIslands)

      // Generate rock colliders
      const rockColliders = generateRockColliders(generatedIslands, 30, 140)
      state.setRockColliders(rockColliders)

      // Generate coins
      const generatedCoins = generateCoins(generatedIslands)
      state.setCoins(generatedCoins)
    }

    // Initialize entities with data
    const islands = useGameStore.getState().islands
    this.islands.setIslands(islands, [])
    this.oceanRocks.generate(islands, 30, 140)
    this.coins.setCoins(useGameStore.getState().coins)
  }

  private setupSubscriptions(): void {
    // Track previous values for change detection
    let prevPhase = useGameStore.getState().phase
    let prevBoatType = useGameStore.getState().boatType
    let prevStage = useGameStore.getState().stage
    let prevCoins = useGameStore.getState().coins
    let prevOtherPlayers = useGameStore.getState().otherPlayers
    let prevCannonballs = useGameStore.getState().cannonballs

    this.unsubscribers.push(
      useGameStore.subscribe((state) => {
        // Phase change (detect reset - going back to intro)
        if (state.phase !== prevPhase) {
          const wasReset = prevPhase !== 'intro' && state.phase === 'intro'
          prevPhase = state.phase

          if (wasReset) {
            // Reset AI system
            this.aiSystem.reset()
            // Reset boat to dinghy
            this.boat.setBoatType('dinghy')
            // Clear AI ships
            this.aiShips.updatePlayers([])
            // Clear cannonballs
            this.cannonballs.updateBalls([])
            // Reset stage tracking
            prevStage = 'exploration'
            prevBoatType = 'dinghy'
          }
        }

        // Boat type change
        if (state.boatType !== prevBoatType) {
          prevBoatType = state.boatType
          this.boat.setBoatType(state.boatType)
        }

        // Stage change (expand world, add partner islands)
        if (state.stage !== prevStage) {
          prevStage = state.stage
          if (state.stage === 'battle') {
            if (state.expandedIslands.length === 0) {
              const partnerIslands = generateExpandedIslands(ACTIVE_PARTNERS)
              state.setExpandedIslands(partnerIslands)
            }
            this.islands.setIslands(
              state.islands,
              useGameStore.getState().expandedIslands,
            )
            this.aiSystem.spawn(6)
          }
        }

        // Coins update
        if (state.coins !== prevCoins) {
          prevCoins = state.coins
          this.coins.setCoins(state.coins)
        }

        // Other players update (AI ships)
        if (state.otherPlayers !== prevOtherPlayers) {
          prevOtherPlayers = state.otherPlayers
          this.aiShips.updatePlayers(state.otherPlayers)
        }

        // Cannonballs update
        if (state.cannonballs !== prevCannonballs) {
          prevCannonballs = state.cannonballs
          this.cannonballs.updateBalls(state.cannonballs)
        }
      }),
    )
  }

  start(): void {
    this.clock.start()
    this.loop()
  }

  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  private loop = (): void => {
    if (this.isDisposed) return

    this.animationFrameId = requestAnimationFrame(this.loop)

    const delta = this.clock.getDelta()
    const time = this.clock.getElapsedTime()

    this.update(delta, time)
    this.render()
  }

  private update(delta: number, time: number): void {
    const state = useGameStore.getState()

    // Always update ocean animation
    this.ocean.update(time)

    // Only update game systems when playing
    if (state.phase === 'playing') {
      // Update systems
      this.boatControlSystem.update(delta)
      this.discoverySystem.update(delta)
      this.coinSystem.update(delta, this.coins)
      this.cameraSystem.update(delta, time)

      if (state.stage === 'battle') {
        this.aiSystem.update(delta)
        this.cannonballSystem.update(delta, this.cannonballs)
        this.aiDebug.update()
      }

      // Update entities
      const { boatPosition, boatRotation, boatVelocity } = state
      this.boat.update(time, boatPosition, boatRotation, boatVelocity)
      this.coins.update(time, boatPosition)
      this.islands.update(time, boatPosition)
      this.oceanRocks.update(time, boatPosition)
      this.boundaryWalls.update(delta)
      this.aiShips.update(time)
      this.cannonballs.update(delta)
    }
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera)
  }

  resize(width: number, height: number): void {
    if (width === 0 || height === 0) return

    // Update canvas resolution with DPR
    const dpr = Math.min(window.devicePixelRatio, 2)
    this.canvas.width = width * dpr
    this.canvas.height = height * dpr
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }

  private handleResize = (): void => {
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    this.resize(width, height)
  }

  private handleClick = (event: MouseEvent): void => {
    const infoGroup = this.raycastInfoGroup(event.clientX, event.clientY)
    if (!infoGroup) return

    // Get island data and navigate
    const island = this.islands.getIslandByInfoGroup(infoGroup)
    if (!island) return

    if (island.type === 'partner' && island.partner?.href) {
      window.open(island.partner.href, '_blank')
    } else if (island.type === 'library' && island.library) {
      window.location.href = `/${island.library.id}`
    }
  }

  private handlePointerMove = (event: PointerEvent): void => {
    const infoGroup = this.raycastInfoGroup(event.clientX, event.clientY)
    this.canvas.style.cursor = infoGroup ? 'pointer' : 'auto'
    this.islands.setInfoHover(infoGroup)
  }

  private raycastInfoGroup(
    clientX: number,
    clientY: number,
  ): THREE.Group | null {
    // Calculate normalized device coordinates
    const rect = this.canvas.getBoundingClientRect()
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1

    // Update raycaster
    this.raycaster.setFromCamera(this.pointer, this.camera)

    // Get clickable info groups
    const clickableGroups = this.islands.getClickableInfoGroups()
    if (clickableGroups.length === 0) return null

    // Check for intersections with info group children (meshes)
    const allMeshes: THREE.Object3D[] = []
    for (const group of clickableGroups) {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          allMeshes.push(child)
        }
      })
    }

    const intersects = this.raycaster.intersectObjects(allMeshes, false)
    if (intersects.length === 0) return null

    // Find the parent info group of the intersected mesh
    let obj: THREE.Object3D | null = intersects[0].object
    while (obj) {
      if (obj.userData.islandId) {
        return obj as THREE.Group
      }
      obj = obj.parent
    }

    return null
  }

  // HMR: Rebuild islands entity with new code
  rebuildIslands(NewIslands: typeof Islands): void {
    // Remove old islands from scene
    this.scene.remove(this.islands.group)
    this.islands.dispose()

    // Create new islands with updated code
    this.islands = new NewIslands()
    this.scene.add(this.islands.group)

    // Re-initialize with current game data
    const { islands, expandedIslands, coins } = useGameStore.getState()
    this.islands.setIslands(islands, expandedIslands)
  }

  dispose(): void {
    this.isDisposed = true
    __hmrEngine = null
    this.stop()

    // Cleanup subscriptions
    this.unsubscribers.forEach((unsub) => unsub())
    this.unsubscribers = []

    // Cleanup systems
    try {
      this.boatControlSystem.dispose()
    } catch (e) {
      console.warn('Error disposing boatControlSystem:', e)
    }

    // Cleanup entities
    try {
      this.sky.dispose()
      this.ocean.dispose()
      this.boat.dispose()
      this.coins.dispose()
      this.islands.dispose()
      this.oceanRocks.dispose()
      this.boundaryWalls.dispose()
      this.aiShips.dispose()
      this.cannonballs.dispose()
      this.aiDebug.dispose()
    } catch (e) {
      console.warn('Error disposing entities:', e)
    }

    // Cleanup renderer
    try {
      this.renderer.dispose()
    } catch (e) {
      console.warn('Error disposing renderer:', e)
    }

    window.removeEventListener('resize', this.handleResize)
    this.canvas.removeEventListener('click', this.handleClick)
    this.canvas.removeEventListener('pointermove', this.handlePointerMove)
  }
}

// HMR support for Islands
if (import.meta.hot) {
  import.meta.hot.accept('./entities/Islands', (newModule) => {
    if (newModule && __hmrEngine) {
      console.log('[HMR] Rebuilding islands...')
      __hmrEngine.rebuildIslands(newModule.Islands)
    }
  })
}
