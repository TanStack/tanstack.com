import { useProgressionSync } from './useProgressionSync'

/**
 * Component that syncs game store state with the progression state machine.
 * Must be rendered inside GameMachineProvider.
 */
export function ProgressionSync() {
  useProgressionSync()
  return null
}
