import { useGameStore } from '../hooks/useGameStore'
import { getAvailableItems } from '../utils/shopItems'

export function Shop() {
  const { isShopOpen, closeShop, purchaseItem, coinsCollected, stage } =
    useGameStore()

  if (!isShopOpen) return null

  const availableItems = getAvailableItems(stage)

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-900/95 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Shop</h2>
          <div className="flex items-center gap-2">
            <span className="text-yellow-400 text-lg">🪙</span>
            <span className="text-yellow-400 font-bold">{coinsCollected}</span>
          </div>
        </div>

        <div className="space-y-3">
          {availableItems.map((item) => {
            const canAfford = coinsCollected >= item.cost

            return (
              <button
                key={item.type}
                onClick={() => purchaseItem(item.type)}
                disabled={!canAfford}
                className={`w-full p-4 rounded-lg border transition-all flex items-center gap-4 ${
                  canAfford
                    ? 'bg-gray-800 border-gray-600 hover:border-yellow-500 hover:bg-gray-700 cursor-pointer'
                    : 'bg-gray-800/50 border-gray-700 opacity-50 cursor-not-allowed'
                }`}
              >
                <span className="text-3xl">{item.icon}</span>
                <div className="flex-1 text-left">
                  <div className="text-white font-semibold">{item.name}</div>
                  <div className="text-gray-400 text-sm">
                    {item.description}
                  </div>
                </div>
                <div
                  className={`font-bold ${canAfford ? 'text-yellow-400' : 'text-gray-500'}`}
                >
                  🪙 {item.cost}
                </div>
              </button>
            )
          })}
        </div>

        <button
          onClick={closeShop}
          className="mt-4 w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  )
}
