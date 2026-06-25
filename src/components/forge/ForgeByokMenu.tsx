import { ChevronDown, KeyRound, Loader2, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  Dropdown,
  DropdownContent,
  DropdownTrigger,
} from '~/components/Dropdown'
import {
  sealForgeBrowserProviderKey,
  type ForgeBrowserProviderKey,
} from '~/utils/forge.functions'
import {
  clearForgeBrowserProviderKey,
  forgeByokProviderOptions,
  getDefaultForgeByokModel,
  getForgeByokProviderLabel,
  parseForgeBrowserByokProvider,
  readForgeBrowserProviderKey,
  writeForgeBrowserProviderKey,
  type ForgeBrowserByokProvider,
} from '~/utils/forge-byok'

type ForgeByokMenuProps = {
  disabled?: boolean
  onProviderKeyChange: (key: ForgeBrowserProviderKey | undefined) => void
  providerKey?: ForgeBrowserProviderKey
  required?: boolean
}

export function ForgeByokMenu({
  disabled,
  onProviderKeyChange,
  providerKey,
  required,
}: ForgeByokMenuProps) {
  const [open, setOpen] = useState(false)
  const [provider, setProvider] = useState<ForgeBrowserByokProvider>('openai')
  const [model, setModel] = useState<string>(() =>
    getDefaultForgeByokModel('openai'),
  )
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const onProviderKeyChangeRef = useRef(onProviderKeyChange)

  useEffect(() => {
    onProviderKeyChangeRef.current = onProviderKeyChange
  }, [onProviderKeyChange])

  useEffect(() => {
    const storedProviderKey = readForgeBrowserProviderKey()

    if (!storedProviderKey) {
      return
    }

    setProvider(storedProviderKey.provider)
    setModel(
      storedProviderKey.model ??
        getDefaultForgeByokModel(storedProviderKey.provider),
    )
    onProviderKeyChangeRef.current(storedProviderKey)
  }, [])

  async function handleSave() {
    const trimmedApiKey = apiKey.trim()
    const trimmedModel = model.trim() || getDefaultForgeByokModel(provider)

    if (!trimmedApiKey || isSaving) {
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const sealedProviderKey = await sealForgeBrowserProviderKey({
        data: {
          apiKey: trimmedApiKey,
          model: trimmedModel,
          provider,
        },
      })

      writeForgeBrowserProviderKey(sealedProviderKey)
      onProviderKeyChange(sealedProviderKey)
      setApiKey('')
      setOpen(false)
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Forge provider key could not be sealed.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  function handleProviderChange(nextProvider: ForgeBrowserByokProvider) {
    setProvider(nextProvider)
    setModel(getDefaultForgeByokModel(nextProvider))
    setError(null)
  }

  function handleClear() {
    clearForgeBrowserProviderKey()
    onProviderKeyChange(undefined)
    setApiKey('')
    setError(null)
  }

  return (
    <Dropdown open={open} onOpenChange={setOpen}>
      <DropdownTrigger>
        <button
          className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2 text-xs transition ${
            providerKey
              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-300 dark:hover:bg-emerald-400/15'
              : required
                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-400/10 dark:text-amber-200 dark:hover:bg-amber-400/15'
                : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white'
          }`}
          disabled={disabled}
          title="Forge provider key"
          type="button"
        >
          <KeyRound className="h-3.5 w-3.5" />
          <span>
            {providerKey ? providerKey.label : required ? 'Add key' : 'BYOK'}
          </span>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </DropdownTrigger>
      <DropdownContent
        align="start"
        className="w-80 border-neutral-200 bg-white p-3 text-neutral-900 dark:border-white/10 dark:bg-[#242424] dark:text-neutral-100"
        sideOffset={8}
      >
        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium">Provider key</div>
            <div className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              Stored in this browser as a server-sealed blob. Forge decrypts it
              only while starting a run.
            </div>
          </div>

          {required && !providerKey ? (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:bg-amber-400/10 dark:text-amber-100">
              This Forge environment requires your own provider key before
              starting a run.
            </div>
          ) : null}

          {providerKey ? (
            <div className="rounded-lg bg-neutral-100 px-3 py-2 text-xs dark:bg-white/10">
              <div className="font-medium">{providerKey.label}</div>
              <div className="mt-1 text-neutral-500 dark:text-neutral-400">
                {getForgeByokProviderLabel(providerKey.provider)}
                {providerKey.model ? ` · ${providerKey.model}` : ''}
              </div>
            </div>
          ) : null}

          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-300">
            Provider
            <select
              className="mt-1 h-9 w-full rounded-md border border-neutral-200 bg-white px-2 text-sm outline-none focus:border-neutral-400 dark:border-white/10 dark:bg-[#1b1b1b] dark:text-white"
              onChange={(event) =>
                handleProviderChange(
                  parseForgeBrowserByokProvider(event.currentTarget.value),
                )
              }
              value={provider}
            >
              {forgeByokProviderOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-300">
            Model
            <input
              className="mt-1 h-9 w-full rounded-md border border-neutral-200 bg-white px-2 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-400 dark:border-white/10 dark:bg-[#1b1b1b] dark:text-white"
              onChange={(event) => setModel(event.currentTarget.value)}
              placeholder={getDefaultForgeByokModel(provider)}
              value={model}
            />
          </label>

          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-300">
            API key
            <input
              autoComplete="off"
              className="mt-1 h-9 w-full rounded-md border border-neutral-200 bg-white px-2 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-400 dark:border-white/10 dark:bg-[#1b1b1b] dark:text-white"
              onChange={(event) => setApiKey(event.currentTarget.value)}
              placeholder={
                provider === 'openai' ? 'sk-...' : 'sk-ant-api03-...'
              }
              type="password"
              value={apiKey}
            />
          </label>

          {error ? (
            <div className="rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:bg-red-400/10 dark:text-red-200">
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <button
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white"
              disabled={!providerKey || isSaving}
              onClick={handleClear}
              type="button"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
            <button
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-neutral-950 px-3 text-xs font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400 dark:bg-white dark:text-black dark:hover:bg-neutral-200 dark:disabled:bg-white/10 dark:disabled:text-neutral-600"
              disabled={!apiKey.trim() || isSaving}
              onClick={handleSave}
              type="button"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Save sealed key
            </button>
          </div>
        </div>
      </DropdownContent>
    </Dropdown>
  )
}
