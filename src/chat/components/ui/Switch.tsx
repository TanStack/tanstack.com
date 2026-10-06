import { Switch as BaseSwitch } from '@base-ui/react/switch'
import './switch.css'

export function Switch(props: BaseSwitch.Root.Props) {
  return (
    <BaseSwitch.Root {...props} className="ui-switch">
      <BaseSwitch.Thumb className="ui-switch-thumb" />
    </BaseSwitch.Root>
  )
}
