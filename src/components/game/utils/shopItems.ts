// Shop items that can be purchased with coins

export type ShopItemType = 'compass' | 'speedBoost' | 'healthPack'

export interface ShopItem {
  type: ShopItemType
  name: string
  description: string
  cost: number
  icon: string
  // Which stages this item is available in
  stages: ('exploration' | 'battle')[]
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    type: 'compass',
    name: 'Compass',
    description: 'Points to a random undiscovered island',
    cost: 10,
    icon: '🧭',
    stages: ['exploration', 'battle'],
  },
  {
    type: 'speedBoost',
    name: 'Speed Boost',
    description: 'Temporary 2x speed for 10 seconds',
    cost: 5,
    icon: '⚡',
    stages: ['exploration', 'battle'],
  },
  {
    type: 'healthPack',
    name: 'Health Pack',
    description: 'Restore 50 health',
    cost: 15,
    icon: '💊',
    stages: ['battle'],
  },
]

export function getAvailableItems(stage: 'exploration' | 'battle'): ShopItem[] {
  return SHOP_ITEMS.filter((item) => item.stages.includes(stage))
}
