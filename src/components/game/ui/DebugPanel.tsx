import { useGameStore } from '../hooks/useGameStore'
import { UPGRADES, UPGRADE_ORDER } from '../utils/upgrades'

export function DebugPanel() {
  const {
    phase,
    stage,
    islands,
    expandedIslands,
    coins,
    discoveredIslands,
    coinsCollected,
    unlockedUpgrades,
    shipStats,
    boatHealth,
  } = useGameStore()

  const discoverAllIslands = () => {
    const { islands, discoverIsland } = useGameStore.getState()
    // Discover all but don't trigger upgrade (skip last one)
    islands.slice(0, -1).forEach((island) => {
      discoverIsland(island.id)
    })
  }

  const discoverLastIsland = () => {
    const { islands, discoverIsland } = useGameStore.getState()
    const lastIsland = islands[islands.length - 1]
    if (lastIsland) {
      discoverIsland(lastIsland.id)
    }
  }

  const collectCoins = (count: number) => {
    const { coins, collectCoin } = useGameStore.getState()
    const uncollected = coins.filter((c) => !c.collected)
    uncollected.slice(0, count).forEach((coin) => {
      collectCoin(coin.id)
    })
  }

  const skipToPlaying = () => {
    useGameStore.setState({ phase: 'playing' })
  }

  const skipToBattle = () => {
    useGameStore.setState({
      phase: 'playing',
      stage: 'battle',
      boatType: 'ship',
      worldBoundary: 180,
    })
  }

  const discoverNextPartner = () => {
    const { expandedIslands, discoveredIslands, discoverIsland } =
      useGameStore.getState()
    const partnerIslands = expandedIslands.filter((i) => i.type === 'partner')
    const undiscovered = partnerIslands.find(
      (i) => !discoveredIslands.has(i.id),
    )
    if (undiscovered) {
      discoverIsland(undiscovered.id)
    }
  }

  const grantNextUpgrade = () => {
    const { unlockedUpgrades, applyShipUpgrade } = useGameStore.getState()
    const nextUpgrade = UPGRADE_ORDER[unlockedUpgrades.length]
    if (nextUpgrade) {
      applyShipUpgrade(nextUpgrade)
      useGameStore.setState({ lastUnlockedUpgrade: nextUpgrade })
    }
  }

  const grantAllUpgrades = () => {
    const { applyShipUpgrade } = useGameStore.getState()
    UPGRADE_ORDER.forEach((upgrade) => {
      applyShipUpgrade(upgrade)
    })
  }

  const takeDamage = (amount: number) => {
    const { boatHealth, setBoatHealth } = useGameStore.getState()
    setBoatHealth(Math.max(0, boatHealth - amount))
  }

  const healFull = () => {
    const { shipStats, setBoatHealth } = useGameStore.getState()
    setBoatHealth(shipStats.maxHealth)
  }

  if (phase === 'intro') {
    return (
      <div className="absolute top-4 left-4 z-50 bg-black/80 text-white p-3 rounded-lg text-xs font-mono space-y-2">
        <div className="text-yellow-400 font-bold">DEBUG</div>
        <button
          onClick={skipToPlaying}
          className="block w-full px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded"
        >
          Skip Intro
        </button>
      </div>
    )
  }

  const partnerIslands = expandedIslands.filter((i) => i.type === 'partner')
  const discoveredPartners = partnerIslands.filter((i) =>
    discoveredIslands.has(i.id),
  ).length

  return (
    <div className="absolute top-4 left-4 z-50 bg-black/80 text-white p-3 rounded-lg text-xs font-mono space-y-2 max-w-52">
      <div className="text-yellow-400 font-bold">DEBUG</div>
      <div className="text-gray-400">
        Phase: {phase} | Stage: {stage}
      </div>
      <div className="text-gray-400">
        Islands: {discoveredIslands.size}/{islands.length}
      </div>
      <div className="text-gray-400">
        Coins: {coinsCollected}/{coins.length}
      </div>

      {stage === 'battle' && (
        <>
          <div className="text-gray-400">
            Partners: {discoveredPartners}/{partnerIslands.length}
          </div>
          <div className="text-gray-400">
            Upgrades: {unlockedUpgrades.length}/{UPGRADE_ORDER.length}
          </div>
          <div className="text-gray-400">
            HP: {Math.round(boatHealth)}/{shipStats.maxHealth}
          </div>
          {unlockedUpgrades.length > 0 && (
            <div className="text-green-400 text-[10px]">
              {unlockedUpgrades.map((u) => u.name).join(', ')}
            </div>
          )}
        </>
      )}

      <div className="border-t border-gray-600 pt-2 space-y-1">
        {stage === 'exploration' && (
          <>
            <button
              onClick={discoverAllIslands}
              className="block w-full px-2 py-1 bg-green-600 hover:bg-green-500 rounded"
            >
              Discover All (except last)
            </button>
            <button
              onClick={discoverLastIsland}
              className="block w-full px-2 py-1 bg-orange-600 hover:bg-orange-500 rounded"
            >
              Discover Last (trigger upgrade)
            </button>
            <button
              onClick={() => collectCoins(10)}
              className="block w-full px-2 py-1 bg-yellow-600 hover:bg-yellow-500 rounded"
            >
              Collect 10 Coins
            </button>
            <button
              onClick={() => collectCoins(50)}
              className="block w-full px-2 py-1 bg-yellow-600 hover:bg-yellow-500 rounded"
            >
              Collect All Coins
            </button>
            <button
              onClick={skipToBattle}
              className="block w-full px-2 py-1 bg-purple-600 hover:bg-purple-500 rounded"
            >
              Skip to Battle Stage
            </button>
          </>
        )}

        {stage === 'battle' && (
          <>
            <button
              onClick={discoverNextPartner}
              className="block w-full px-2 py-1 bg-green-600 hover:bg-green-500 rounded"
            >
              Discover Next Partner
            </button>
            <button
              onClick={grantNextUpgrade}
              className="block w-full px-2 py-1 bg-cyan-600 hover:bg-cyan-500 rounded"
            >
              Grant Next Upgrade
            </button>
            <button
              onClick={grantAllUpgrades}
              className="block w-full px-2 py-1 bg-cyan-700 hover:bg-cyan-600 rounded"
            >
              Grant All Upgrades
            </button>
            <button
              onClick={() => takeDamage(25)}
              className="block w-full px-2 py-1 bg-red-600 hover:bg-red-500 rounded"
            >
              Take 25 Damage
            </button>
            <button
              onClick={healFull}
              className="block w-full px-2 py-1 bg-pink-600 hover:bg-pink-500 rounded"
            >
              Heal to Full
            </button>
            <button
              onClick={() => takeDamage(999)}
              className="block w-full px-2 py-1 bg-red-800 hover:bg-red-700 rounded"
            >
              Kill Player (Test Game Over)
            </button>
          </>
        )}

        <button
          onClick={() => useGameStore.getState().reset()}
          className="block w-full px-2 py-1 bg-red-600 hover:bg-red-500 rounded"
        >
          Reset Game
        </button>
      </div>
    </div>
  )
}
