import { useId, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { IconButton } from '../IconButton'
import './action-card.css'

export function ActionCard({
  title,
  description,
  icon,
  actions,
  children,
  onDismiss,
  disabled,
}: {
  title: string
  description?: string
  icon?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  onDismiss?: () => void
  disabled?: boolean
}) {
  const titleId = useId()
  return (
    <section className="ui-action-card" aria-labelledby={titleId}>
      <div className="ui-action-card-heading">
        {icon}
        <h3 id={titleId}>{title}</h3>
        {onDismiss && (
          <IconButton
            label="Dismiss task"
            disabled={disabled}
            onClick={onDismiss}
          >
            <X aria-hidden />
          </IconButton>
        )}
      </div>
      {description && (
        <p className="ui-action-card-description">{description}</p>
      )}
      {children}
      {actions && <div className="ui-action-card-actions">{actions}</div>}
    </section>
  )
}
