import { useSelector } from '@tanstack/react-store'
import { gameStore } from '../hooks/useGameStore'
import { Dinghy } from './Dinghy'
import { Ship } from './Ship'

interface BoatProps {
  color?: string
}

export function Boat({ color = '#FFEEDD' }: BoatProps) {
  const boatType = useSelector(gameStore, (s) => s.boatType)

  if (boatType === 'dinghy') {
    return <Dinghy color="#C4A484" />
  }

  return <Ship color={color} />
}
