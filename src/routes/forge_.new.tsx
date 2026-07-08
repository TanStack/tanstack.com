import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useHotkey } from '@tanstack/react-hotkeys'
import {
  ArrowUp,
  ChevronDown,
  CornerUpRight,
  EllipsisVertical,
  Folder,
  GitBranch,
  Loader2,
  Mic,
  Plus,
  Settings,
  Trash2,
  Zap,
} from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
} from '~/components/Dropdown'
import {
  createForgeChatShell,
  deleteForgeChatShell,
  getForgeChatShells,
  getForgeRunConfig,
  type ForgeBrowserProviderKey,
  type ForgeChatShell,
} from '~/utils/forge.functions'
import { forgeChatShellsQueryKey } from '~/utils/forge-collections'
import { writeForgePendingLaunch } from '~/utils/forge-pending-launch'
import { ForgeByokMenu } from '~/components/forge/ForgeByokMenu'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/forge_/new')({
  head: () => ({
    meta: seo({
      title: 'New Forge Chat',
      description: 'Start a new TanStack Forge agent run.',
    }),
  }),
  component: ForgeNewRoute,
})

function ForgeNewRoute() {
  const navigate = Route.useNavigate()
  const queryClient = useQueryClient()
  const [prompt, setPrompt] = useState('')
  const [browserProviderKey, setBrowserProviderKey] =
    useState<ForgeBrowserProviderKey>()
  const [error, setError] = useState<string | null>(null)
  const [chats, setChats] = useState<Array<ForgeChatShell>>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [runRequiresProviderKey, setRunRequiresProviderKey] = useState(false)
  const promptFormRef = useRef<HTMLFormElement>(null)
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null)
  const isMissingRequiredProviderKey =
    runRequiresProviderKey && !browserProviderKey
  const missingProviderKeyText =
    'Add a Forge provider key before starting a run.'
  const canSubmit =
    prompt.trim().length > 0 && !isSubmitting && !isMissingRequiredProviderKey

  useEffect(() => {
    promptTextareaRef.current?.focus()
  }, [])

  useEffect(() => {
    let cancelled = false

    void getForgeChatShells()
      .then((result) => {
        if (!cancelled) {
          setChats(result.chats)
          queryClient.setQueryData(forgeChatShellsQueryKey, result.chats)
          setRunRequiresProviderKey(result.runRequiresProviderKey)
        }
      })
      .catch((chatListError: unknown) => {
        if (!cancelled) {
          console.error('Forge chat list could not load.', chatListError)
        }
      })

    return () => {
      cancelled = true
    }
  }, [queryClient])

  useEffect(() => {
    let cancelled = false

    void getForgeRunConfig()
      .then((config) => {
        if (!cancelled) {
          setRunRequiresProviderKey(config?.runRequiresProviderKey ?? false)
        }
      })
      .catch((configError: unknown) => {
        if (!cancelled) {
          setError(
            configError instanceof Error
              ? configError.message
              : 'Forge run settings could not load.',
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useHotkey(
    'Enter',
    (event) => {
      if (event.isComposing || event.shiftKey) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      if (!canSubmit) {
        return
      }

      promptFormRef.current?.requestSubmit()
    },
    {
      ignoreInputs: false,
      preventDefault: false,
      stopPropagation: false,
      target: promptTextareaRef,
    },
  )

  function upsertChatShell(chat: ForgeChatShell) {
    setChats((currentChats) => [
      chat,
      ...currentChats.filter((item) => item.id !== chat.id),
    ])
    queryClient.setQueryData<Array<ForgeChatShell>>(
      forgeChatShellsQueryKey,
      (currentChats) => [
        chat,
        ...(currentChats ?? []).filter((item) => item.id !== chat.id),
      ],
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextPrompt = prompt.trim()

    if (!nextPrompt || isSubmitting) {
      return
    }

    if (isMissingRequiredProviderKey) {
      setError(missingProviderKeyText)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const nextChat = await createForgeChatShell()
      const clientRequestId = `forge-request-${crypto.randomUUID()}`
      const createdAt = new Date().toISOString()
      writeForgePendingLaunch({
        chatId: nextChat.activeChatId,
        clientRequestId,
        createdAt,
        prompt: nextPrompt,
        providerKey: browserProviderKey,
      })
      upsertChatShell({
        ...nextChat.chat,
        latestRunId: clientRequestId,
        latestRunStatus: 'running',
        title: nextPrompt.slice(0, 64),
        updatedAt: createdAt,
      })
      await navigate({
        search: {
          chatId: nextChat.activeChatId,
        },
        to: '/forge',
      })
    } catch (submitError) {
      setIsSubmitting(false)
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Forge chat could not start.',
      )
    }
  }

  function handleDeleteChat(chatId: string) {
    if (isSubmitting) {
      return
    }

    setError(null)
    setChats((currentChats) =>
      currentChats.filter((chat) => chat.id !== chatId),
    )

    void deleteForgeChatShell({ data: { chatId } })
      .then((result) => {
        setChats(result.chats)
        queryClient.setQueryData(forgeChatShellsQueryKey, result.chats)
      })
      .catch(async (deleteError: unknown) => {
        setError(
          deleteError instanceof Error
            ? deleteError.message
            : 'Forge chat could not delete.',
        )
        await queryClient.invalidateQueries({
          queryKey: forgeChatShellsQueryKey,
        })
      })
  }

  return (
    <main className="h-[calc(100dvh-var(--navbar-height))] overflow-hidden bg-neutral-50 text-neutral-950 dark:bg-[#0c0c0c] dark:text-neutral-100">
      <div className="grid h-full grid-cols-1 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="hidden min-h-0 flex-col border-r border-neutral-200 bg-neutral-100 dark:border-white/10 dark:bg-[#222323] lg:flex">
          <div className="min-h-0 flex-1 overflow-auto px-2 py-3">
            <button
              className="mb-2 flex w-full items-center gap-2 rounded-md bg-neutral-950/[0.04] px-2 py-1.5 text-left text-xs text-neutral-950 dark:bg-white/[0.06] dark:text-white"
              disabled
              type="button"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="min-w-0 flex-1 truncate">New chat</span>
            </button>

            <div className="mt-3 space-y-1">
              {chats.length > 0 ? (
                chats.map((chat) => (
                  <ForgeNewSidebarChatRow
                    chat={chat}
                    deleteDisabled={isSubmitting}
                    key={chat.id}
                    onDelete={() => handleDeleteChat(chat.id)}
                    onSelect={() =>
                      navigate({
                        search: {
                          chatId: chat.id,
                        },
                        to: '/forge',
                      })
                    }
                    selectDisabled={isSubmitting}
                  />
                ))
              ) : (
                <div className="px-2 py-1.5 text-xs text-neutral-500 dark:text-neutral-500">
                  No chats yet.
                </div>
              )}
            </div>
          </div>
        </aside>

        <section className="min-h-0 overflow-auto bg-white px-6 dark:bg-[#151515]">
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center py-12">
            <h1 className="mb-10 text-center text-4xl font-medium text-neutral-900 dark:text-neutral-100">
              What should we build in tanstack.com?
            </h1>

            <div className="w-full">
              <form onSubmit={handleSubmit} ref={promptFormRef}>
                <div className="overflow-hidden rounded-[22px] border border-neutral-200 bg-white shadow-xl shadow-neutral-200/60 dark:border-white/10 dark:bg-[#242424] dark:shadow-black/30">
                  <textarea
                    className="max-h-44 min-h-28 w-full resize-none bg-transparent px-5 py-5 text-sm leading-6 text-neutral-950 outline-none placeholder:text-neutral-400 dark:text-white dark:placeholder:text-neutral-500"
                    disabled={isMissingRequiredProviderKey}
                    onChange={(event) => setPrompt(event.currentTarget.value)}
                    placeholder={
                      isMissingRequiredProviderKey
                        ? 'Add a provider key to start'
                        : 'Do anything'
                    }
                    ref={promptTextareaRef}
                    value={prompt}
                  />
                  <div className="flex items-center justify-between gap-3 px-4 pb-3.5">
                    <div className="flex min-w-0 items-center gap-2 text-xs">
                      <button
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white"
                        title="Add context"
                        type="button"
                      >
                        <Plus className="h-5 w-5" />
                        <span className="sr-only">Add context</span>
                      </button>
                      <ForgeByokMenu
                        disabled={isSubmitting}
                        onProviderKeyChange={(key) => {
                          setBrowserProviderKey(key)
                          if (key) {
                            setError(null)
                          }
                        }}
                        providerKey={browserProviderKey}
                        required={runRequiresProviderKey}
                      />
                    </div>

                    <div className="flex shrink-0 items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                      <button
                        className="inline-flex h-9 items-center gap-2 rounded-full px-2 transition hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-white/10 dark:hover:text-white"
                        type="button"
                      >
                        <Zap className="h-4 w-4" />
                        <span>5.5 Extra High</span>
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-white/10 dark:hover:text-white"
                        title="Voice input"
                        type="button"
                      >
                        <Mic className="h-4 w-4" />
                        <span className="sr-only">Voice input</span>
                      </button>
                      <button
                        className={sendButtonClassName(canSubmit)}
                        disabled={!canSubmit}
                        title="Start"
                        type="submit"
                      >
                        {isSubmitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowUp className="h-5 w-5" />
                        )}
                        <span className="sr-only">
                          {isSubmitting ? 'Starting' : 'Start'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              <div className="-mt-2 flex min-h-16 flex-wrap items-end gap-x-6 gap-y-3 rounded-b-[22px] bg-neutral-100 px-5 pb-4 pt-6 text-xs text-neutral-500 dark:bg-[#202020] dark:text-neutral-400">
                <button
                  className="inline-flex items-center gap-2 transition hover:text-neutral-800 dark:hover:text-white"
                  type="button"
                >
                  <Folder className="h-4 w-4" />
                  <span>tanstack.com</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  className="inline-flex items-center gap-2 transition hover:text-neutral-800 dark:hover:text-white"
                  type="button"
                >
                  <CornerUpRight className="h-4 w-4" />
                  <span>New worktree</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  className="inline-flex items-center gap-2 transition hover:text-neutral-800 dark:hover:text-white"
                  type="button"
                >
                  <Settings className="h-4 w-4" />
                  <span>No environment</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  className="inline-flex items-center gap-2 transition hover:text-neutral-800 dark:hover:text-white"
                  type="button"
                >
                  <GitBranch className="h-4 w-4" />
                  <span>main</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>

              {error ? (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
                  {error}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function ForgeNewSidebarChatRow({
  chat,
  deleteDisabled,
  onDelete,
  onSelect,
  selectDisabled,
}: {
  chat: ForgeChatShell
  deleteDisabled: boolean
  onDelete: () => void
  onSelect: () => void
  selectDisabled: boolean
}) {
  return (
    <div className="group flex items-center rounded-md text-neutral-700 transition hover:bg-neutral-200/80 hover:text-neutral-950 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white">
      <button
        className="min-w-0 flex-1 rounded-l-md px-2 py-1.5 text-left text-xs"
        disabled={selectDisabled}
        onClick={onSelect}
        type="button"
      >
        <span className="block truncate">{chat.title}</span>
      </button>
      <Dropdown>
        <DropdownTrigger>
          <button
            aria-label={`Open menu for ${chat.title}`}
            className={`mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100 ${
              deleteDisabled
                ? 'cursor-not-allowed text-neutral-400 dark:text-neutral-700'
                : 'text-neutral-400 hover:bg-neutral-300/70 hover:text-neutral-950 dark:text-neutral-500 dark:hover:bg-white/10 dark:hover:text-white'
            }`}
            disabled={deleteDisabled}
            title="Chat actions"
            type="button"
          >
            <EllipsisVertical className="h-3.5 w-3.5" />
          </button>
        </DropdownTrigger>
        <DropdownContent
          align="end"
          className="min-w-36 rounded-md border-neutral-200 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#242424]"
          sideOffset={4}
        >
          <DropdownItem
            className="text-xs text-red-600 hover:bg-red-50 focus:bg-red-50 dark:text-red-300 dark:hover:bg-red-400/10 dark:focus:bg-red-400/10"
            onSelect={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete chat</span>
          </DropdownItem>
        </DropdownContent>
      </Dropdown>
    </div>
  )
}

function sendButtonClassName(enabled: boolean) {
  const base =
    'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition'

  if (!enabled) {
    return `${base} cursor-not-allowed bg-neutral-200 text-neutral-400 dark:bg-white/10 dark:text-neutral-600`
  }

  return `${base} bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200`
}
