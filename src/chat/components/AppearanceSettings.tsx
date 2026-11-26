import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  appearanceSchema,
  choosePairedPreset,
  defaultAppearance,
  presets,
  resolvePalette,
  surprisePalette,
  usesSeparatePalettes,
  type AppearancePreferences,
  type ThemePalette,
} from '../core/appearance'
import { useAccountPreferences } from './account-preferences-client'
import {
  applyAppearance,
  setAppearanceSettings,
  useAppearanceSettings,
} from './Appearance'
import {
  localOnly,
  saveSyncedAppearance,
  setLocalOnly,
} from './appearance-account'
import { Button } from './ui/Button'
import { SelectField } from './SelectField'
import './appearance-settings.css'

export function AppearanceAccountSync({ userId }: { userId: string }) {
  const query = useAccountPreferences(userId)
  useEffect(() => {
    if (query.data && !localOnly(userId))
      setAppearanceSettings(query.data.appearance ?? defaultAppearance)
  }, [query.data])
  return null
}

export function AppearanceSettings({ userId }: { userId: string }) {
  const query = useAccountPreferences(userId)
  const client = useQueryClient()
  const [stored, setStored] = useAppearanceSettings()
  const [draft, setDraft] = useState<AppearancePreferences>(stored)
  const savedRef = useRef(stored)
  savedRef.current = stored
  useEffect(() => () => applyAppearance(savedRef.current), [])
  const [sync, setSync] = useState(true)
  useEffect(() => setSync(!localOnly(userId)), [userId])
  const [editing, setEditing] = useState<'light' | 'dark'>('light')
  const [customizing, setCustomizing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    setDraft(stored)
  }, [stored])
  const update = (next: AppearancePreferences) => {
    setDraft(next)
    applyAppearance(next)
    setNotice('')
  }
  const paired = draft.mode === 'system' && !usesSeparatePalettes(draft)
  const palette = resolvePalette(draft, editing)
  const customKey = editing === 'light' ? 'lightCustom' : 'darkCustom'
  const presetKey = editing === 'light' ? 'lightPreset' : 'darkPreset'
  const intensityKey = editing === 'light' ? 'lightIntensity' : 'darkIntensity'
  const changed = JSON.stringify(draft) !== JSON.stringify(stored)
  const pairedPreset =
    draft.lightPreset === draft.darkPreset &&
    !draft.lightCustom &&
    !draft.darkCustom
      ? draft.lightPreset
      : null
  const save = async (next = draft, nextSync = sync) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const validated = appearanceSchema.parse(next)
      if (nextSync) {
        if (!query.data) throw Error('Account preferences are still loading.')
        await saveSyncedAppearance(
          userId,
          validated,
          query.data,
          async () => (await query.refetch()).data,
          client,
        )
      }
      setLocalOnly(userId, !nextSync)
      setSync(nextSync)
      setStored(validated)
      setNotice('Appearance saved.')
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not save appearance.',
      )
    } finally {
      setBusy(false)
    }
  }
  const setColor = (field: keyof ThemePalette, value: string) =>
    update({
      ...draft,
      separatePalettes: true,
      [customKey]: { ...palette, [field]: value },
    })
  const surprise = () => {
    if (!paired) {
      update({ ...draft, [customKey]: surprisePalette(editing) })
      return
    }
    const choices = (['lagoon', 'orchid', 'citrus', 'ember'] as const).filter(
      (id) => id !== draft.lightPreset,
    )
    update(
      choosePairedPreset(
        draft,
        choices[Math.floor(Math.random() * choices.length)],
      ),
    )
  }
  const preview = (mode: 'light' | 'dark') => {
    const colors = resolvePalette(draft, mode)
    return (
      <div
        className="appearance-preview"
        style={{ background: colors.background, color: colors.text }}
      >
        <div style={{ background: colors.sidebar }}>Workspace</div>
        <section
          style={{ background: colors.surface, borderColor: colors.line }}
        >
          <strong>Preview conversation</strong>
          <p style={{ color: colors.muted }}>
            A sample message in your palette.
          </p>
          <button
            type="button"
            style={{ background: colors.accent, color: colors.onAccent }}
          >
            Action
          </button>
        </section>
      </div>
    )
  }
  return (
    <div className="appearance-settings">
      <div className="appearance-setting-row">
        <label htmlFor="theme-mode">Mode</label>
        <SelectField
          id="theme-mode"
          value={draft.mode}
          onValueChange={(mode) =>
            update({ ...draft, mode: mode as AppearancePreferences['mode'] })
          }
          items={[
            { value: 'system', label: 'Match device' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </div>
      <div className="appearance-setting-row">
        <label htmlFor="theme-sync">Sync across devices</label>
        <input
          id="theme-sync"
          type="checkbox"
          checked={sync}
          onChange={(event) => {
            const next = event.target.checked
            if (!next) {
              setLocalOnly(userId, true)
              setSync(false)
              setNotice('This device will keep its own appearance.')
              return
            }
            void save(draft, true)
          }}
        />
      </div>
      {sync && query.isError && (
        <div role="alert" className="appearance-sync-error">
          Could not load synced appearance.{' '}
          <Button
            type="button"
            variant="secondary"
            onClick={() => void query.refetch()}
          >
            Retry
          </Button>
        </div>
      )}
      {draft.mode === 'system' && (
        <div className="appearance-link-choice">
          {paired ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => update({ ...draft, separatePalettes: true })}
            >
              Choose light and dark separately
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                update({
                  ...choosePairedPreset(draft, draft[presetKey]),
                  lightIntensity: draft[intensityKey],
                  darkIntensity: draft[intensityKey],
                })
              }
            >
              Use single light/dark preset
            </Button>
          )}
        </div>
      )}
      {!paired && (
        <div
          className="appearance-mode-tabs"
          role="group"
          aria-label="Palette to edit"
        >
          <button
            type="button"
            aria-pressed={editing === 'light'}
            onClick={() => setEditing('light')}
          >
            Light palette
          </button>
          <button
            type="button"
            aria-pressed={editing === 'dark'}
            onClick={() => setEditing('dark')}
          >
            Dark palette
          </button>
        </div>
      )}
      <div
        className={`appearance-preset-grid${paired ? ' appearance-preset-grid-paired' : ''}`}
      >
        {Object.entries(presets).map(([id, entry]) => {
          const swatches = paired
            ? (['light', 'dark'] as const)
            : ([editing] as const)
          return (
            <button
              key={id}
              type="button"
              className={`appearance-preset${paired ? ' appearance-preset-paired' : ''}`}
              aria-pressed={
                paired
                  ? pairedPreset === id
                  : draft[presetKey] === id && !draft[customKey]
              }
              onClick={() =>
                paired
                  ? update(
                      choosePairedPreset(draft, id as keyof typeof presets),
                    )
                  : update({ ...draft, [presetKey]: id, [customKey]: null })
              }
            >
              <span
                className={
                  paired ? 'appearance-pair-swatch' : 'appearance-swatch'
                }
                aria-hidden="true"
              >
                {swatches.map((mode) => {
                  const colors = entry[mode]
                  return (
                    <span key={mode} style={{ background: colors.background }}>
                      <i style={{ background: colors.sidebar }} />
                      <b
                        style={{
                          background: colors.surface,
                          borderColor: colors.line,
                        }}
                      >
                        <em style={{ background: colors.accent }} />
                      </b>
                      {paired && (
                        <small
                          style={{
                            background: colors.surface,
                            color: colors.text,
                          }}
                        >
                          {mode === 'light' ? 'Light' : 'Dark'}
                        </small>
                      )}
                    </span>
                  )
                })}
              </span>
              <span>{entry.label}</span>
            </button>
          )
        })}
      </div>
      <div>
        <Button
          type="button"
          variant="secondary"
          aria-expanded={customizing}
          aria-controls="appearance-color-editor"
          onClick={() => setCustomizing(!customizing)}
        >
          {customizing ? 'Close color editor' : 'Customize colors'}
        </Button>
      </div>
      {customizing && (
        <div id="appearance-color-editor" className="appearance-color-editor">
          <div className="appearance-setting-row">
            <label htmlFor="theme-intensity">
              Color intensity{' '}
              <output>
                {paired ? draft.lightIntensity : draft[intensityKey]}%
              </output>
            </label>
            <input
              id="theme-intensity"
              type="range"
              min="0"
              max="100"
              value={paired ? draft.lightIntensity : draft[intensityKey]}
              disabled={
                paired
                  ? draft.lightPreset === 'contrast' ||
                    draft.lightPreset === 'neutral'
                  : !!draft[customKey] ||
                    draft[presetKey] === 'contrast' ||
                    draft[presetKey] === 'neutral'
              }
              onChange={(event) =>
                update(
                  paired
                    ? {
                        ...draft,
                        lightIntensity: Number(event.target.value),
                        darkIntensity: Number(event.target.value),
                      }
                    : { ...draft, [intensityKey]: Number(event.target.value) },
                )
              }
            />
          </div>
          {paired && (
            <div
              className="appearance-mode-tabs"
              role="group"
              aria-label="Colors to edit"
            >
              <button
                type="button"
                aria-pressed={editing === 'light'}
                onClick={() => setEditing('light')}
              >
                Light colors
              </button>
              <button
                type="button"
                aria-pressed={editing === 'dark'}
                onClick={() => setEditing('dark')}
              >
                Dark colors
              </button>
            </div>
          )}
          <div className="appearance-colors">
            {(
              [
                'background',
                'surface',
                'sidebar',
                'soft',
                'text',
                'muted',
                'line',
                'accent',
                'onAccent',
              ] as const
            ).map((field) => (
              <label key={field}>
                {field === 'onAccent'
                  ? 'Accent text'
                  : field[0].toUpperCase() + field.slice(1)}
                <input
                  type="color"
                  value={palette[field]}
                  onChange={(event) => setColor(field, event.target.value)}
                />
              </label>
            ))}
          </div>
        </div>
      )}
      {paired ? (
        <div className="appearance-pair-previews">
          <div>
            <strong>Light</strong>
            {preview('light')}
          </div>
          <div>
            <strong>Dark</strong>
            {preview('dark')}
          </div>
        </div>
      ) : (
        preview(editing)
      )}
      <div className="appearance-actions">
        <Button type="button" variant="secondary" onClick={surprise}>
          Surprise me
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            update(
              paired
                ? {
                    ...choosePairedPreset(draft, 'neutral'),
                    lightIntensity: 65,
                    darkIntensity: 65,
                  }
                : {
                    ...draft,
                    [presetKey]: 'neutral',
                    [customKey]: null,
                    [intensityKey]: 65,
                  },
            )
          }
        >
          Reset {paired ? 'theme' : `${editing} palette`}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!changed}
          onClick={() => {
            setDraft(stored)
            applyAppearance(stored)
          }}
        >
          Discard preview
        </Button>
        <Button
          type="button"
          disabled={busy || (!changed && !notice)}
          onClick={() => void save()}
        >
          {busy ? 'Saving…' : 'Save appearance'}
        </Button>
      </div>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </div>
  )
}
