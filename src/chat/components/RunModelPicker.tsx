import { LoadingState } from './ui/LoadingState'
import { SelectField } from './SelectField'
import { useId, useRef, useState } from 'react'
import { Popover } from '@base-ui/react/popover'
import { Check, ChevronDown, RefreshCw } from 'lucide-react'
import type { RunModelSelection } from '../core/run-model'
import { IconButton } from './IconButton'
import { resolveRunModelChoice, type RunModelController } from './useRunModel'
import './run-model-picker.css'

export function RunModelPicker({
  model,
  selection = model.selection,
  disabled = false,
  frozen = false,
}: {
  model: Pick<
    RunModelController,
    | 'selection'
    | 'catalog'
    | 'catalogReady'
    | 'loading'
    | 'refreshing'
    | 'error'
    | 'refetch'
    | 'select'
  >
  selection?: RunModelSelection | null
  disabled?: boolean
  frozen?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const errorId = useId()
  const reasoningId = useId()
  const selected = resolveRunModelChoice(
    selection ?? undefined,
    model.catalog,
  ).choice
  const label =
    selected?.label ??
    selection?.model ??
    (selection === null
      ? 'Model not recorded'
      : model.loading
        ? 'Loading models…'
        : 'Choose model')
  const error = frozen ? '' : model.error
  const groups = new Map<
    string,
    NonNullable<RunModelController['catalog']>['choices']
  >()
  for (const choice of model.catalog?.choices ?? []) {
    if (
      !`${choice.label} ${choice.providerLabel} ${choice.selection.model}`
        .toLowerCase()
        .includes(search.toLowerCase().trim())
    )
      continue
    const group = groups.get(choice.providerLabel) ?? []
    group.push(choice)
    groups.set(choice.providerLabel, group)
  }
  return (
    <div className="run-model-picker" aria-busy={model.refreshing || undefined}>
      <Popover.Root
        open={open && !disabled}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setSearch('')
        }}
      >
        <Popover.Trigger
          type="button"
          className="run-model-trigger"
          disabled={disabled}
          aria-label={`Model: ${label}`}
          aria-describedby={error ? errorId : undefined}
        >
          <span>{label}</span>
          <ChevronDown size={13} aria-hidden />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner
            side="top"
            align="start"
            sideOffset={8}
            className="run-model-positioner"
          >
            <Popover.Popup className="run-model-popup" initialFocus={input}>
              <Popover.Title className="run-model-sr-only">
                Choose model
              </Popover.Title>
              <div className="run-model-search">
                <input
                  ref={input}
                  type="search"
                  aria-label="Search models"
                  placeholder="Search models"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <IconButton
                  label="Refresh models"
                  disabled={model.refreshing}
                  onClick={() => void model.refetch()}
                >
                  <RefreshCw size={15} aria-hidden />
                </IconButton>
              </div>
              <div className="run-model-options">
                {[...groups].map(([provider, choices]) => (
                  <section key={provider} aria-label={provider}>
                    <h3>{provider}</h3>
                    {choices.map((choice) => {
                      const active =
                        selection?.provider === choice.selection.provider &&
                        selection.model === choice.selection.model
                      return (
                        <button
                          type="button"
                          className="run-model-option"
                          key={`${choice.selection.provider}:${choice.selection.model}`}
                          aria-pressed={active}
                          disabled={
                            disabled ||
                            !!choice.unavailableReason ||
                            !model.catalogReady
                          }
                          onClick={() => {
                            // Changing model deliberately adopts that model's configured default.
                            model.select(choice.selection)
                            setOpen(false)
                            setSearch('')
                          }}
                        >
                          <span>
                            <strong>{choice.label}</strong>
                            {choice.unavailableReason ? (
                              <small>{choice.unavailableReason}</small>
                            ) : (
                              !!choice.attachments.length && (
                                <small>
                                  {choice.attachments
                                    .map((kind) =>
                                      kind === 'image' ? 'Images' : 'PDFs',
                                    )
                                    .join(' · ')}
                                </small>
                              )
                            )}
                          </span>
                          {active && <Check size={15} aria-hidden />}
                        </button>
                      )
                    })}
                  </section>
                ))}
                {!groups.size &&
                  (model.loading ? (
                    <LoadingState inset>Loading models…</LoadingState>
                  ) : (
                    <p role="status" className="run-model-notice">
                      {search ? 'No matching models.' : 'No models available.'}
                    </p>
                  ))}
              </div>
              {selected?.reasoning.some((mode) => mode.value !== 'default') &&
                selection && (
                  <label className="run-model-reasoning" htmlFor={reasoningId}>
                    Reasoning
                    <SelectField
                      id={reasoningId}
                      value={selection.reasoning ?? 'default'}
                      disabled={
                        disabled ||
                        !model.catalogReady ||
                        !!selected.unavailableReason
                      }
                      onValueChange={(value) =>
                        model.select({
                          provider: selection.provider,
                          model: selection.model,
                          ...(value === 'default'
                            ? {}
                            : {
                                reasoning: value,
                              }),
                        })
                      }
                      items={[
                        ...(!selected.reasoning.some(
                          (mode) => mode.value === 'default',
                        )
                          ? [
                              {
                                value: 'default',
                                label: 'Default',
                              },
                            ]
                          : []),
                        ...selected.reasoning.map((mode) => ({
                          value: mode.value,
                          label: mode.label,
                        })),
                        ...(selection.reasoning &&
                        selection.reasoning !== 'default' &&
                        !selected.reasoning.some(
                          (mode) => mode.value === selection.reasoning,
                        )
                          ? [
                              {
                                value: selection.reasoning,
                                label: <>{selection.reasoning} (unavailable)</>,
                                disabled: true,
                              },
                            ]
                          : []),
                      ]}
                    />
                  </label>
                )}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      {error && (
        <p id={errorId} className="run-model-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
