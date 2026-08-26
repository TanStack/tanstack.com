import * as React from 'react'
import { ArrowLeftIcon, PlusIcon } from '@phosphor-icons/react'

type BuilderEditorSkeletonProps = {
  assistant?: boolean
  headerActions?: boolean
  subtitle?: string
  title?: string
}

type BuilderRouteFrameProps = {
  children: React.ReactNode
  pathname: string
}

export function BuilderRouteFrame({
  children,
  pathname,
}: BuilderRouteFrameProps) {
  if (!getBuilderLoadingKind(pathname)) return <>{children}</>

  return (
    <div
      data-builder-shell=""
      className="grid min-h-[calc(100dvh-var(--navbar-height))] min-w-0 flex-1"
    >
      <div
        data-builder-initial=""
        inert
        className="pointer-events-none col-start-1 row-start-1 min-w-0"
      >
        <BuilderRouteSkeleton pathname={pathname} />
      </div>
      <div className="col-start-1 row-start-1 min-w-0">{children}</div>
    </div>
  )
}

export function BuilderRouteReady({ children }: { children: React.ReactNode }) {
  return (
    <div data-builder-ready="" className="contents">
      {children}
    </div>
  )
}

export function BuilderIndexSkeleton() {
  return (
    <main
      data-builder-loading="index"
      aria-busy="true"
      className="min-h-[calc(100dvh-var(--navbar-height))] bg-background-default px-5 py-12 text-text-primary sm:px-8 sm:py-16"
    >
      <span className="sr-only" role="status">
        Loading projects
      </span>
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            TanStack Builder
          </h1>
          <SkeletonBlock className="h-9 w-32 rounded-lg" />
        </header>
        <p className="mt-3 text-sm text-text-muted">
          Unlisted · anyone with the link can view.
        </p>

        <section className="mt-12" aria-hidden="true">
          <SkeletonBlock className="h-5 w-32" />
          <div className="mt-4 border-y border-border-default">
            <BuilderListSkeletonRows count={2} />
          </div>
        </section>

        <section className="mt-14" aria-hidden="true">
          <h2 className="text-lg font-semibold">Start from an example</h2>
          <div className="mt-4 border-y border-border-default">
            <BuilderListSkeletonRows count={3} actions />
          </div>
        </section>
      </div>
    </main>
  )
}

export function BuilderEditorSkeleton({
  assistant = true,
  headerActions = true,
  subtitle,
  title,
}: BuilderEditorSkeletonProps) {
  return (
    <main
      data-builder-loading="editor"
      aria-busy="true"
      className="fixed inset-x-0 top-[var(--navbar-height)] bottom-0 z-20 flex min-h-0 flex-col overflow-hidden bg-background-default text-text-primary"
    >
      <span className="sr-only" role="status">
        Loading builder
      </span>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border-subtle bg-background-default px-2 sm:gap-3 sm:px-4">
        <a
          href="/builder"
          aria-label="Back to Builder"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-background-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
        </a>

        <div className="min-w-0 flex-1">
          {title ? (
            <h1 className="truncate text-sm font-semibold">{title}</h1>
          ) : (
            <SkeletonBlock className="h-4 w-40 max-w-full" />
          )}
          {subtitle ? (
            <p className="truncate text-xs text-text-muted">{subtitle}</p>
          ) : (
            <SkeletonBlock className="mt-1.5 h-3 w-24 max-w-full" />
          )}
        </div>
        {headerActions ? (
          <div className="flex shrink-0 items-center gap-1" aria-hidden="true">
            <SkeletonBlock className="size-8 rounded-md" />
            <SkeletonBlock className="h-8 w-16 rounded-md" />
          </div>
        ) : null}
      </header>

      <BuilderWorkbenchSkeleton assistant={assistant} fullscreen />
    </main>
  )
}

export function BuilderAiSkeleton() {
  return (
    <BuilderEditorSkeleton
      headerActions={false}
      subtitle="Local spike"
      title="AI builder spike"
    />
  )
}

export function BuilderProjectDraftSkeleton() {
  return <BuilderEditorSkeleton />
}

export function BuilderRouteSkeleton({ pathname }: { pathname: string }) {
  switch (getBuilderLoadingKind(pathname)) {
    case 'index':
      return <BuilderIndexSkeleton />
    case 'ai':
      return <BuilderAiSkeleton />
    case 'draft':
      return <BuilderProjectDraftSkeleton />
    case 'embedded':
      return <BuilderEmbeddedSkeleton />
    case 'editor':
      return <BuilderEditorSkeleton />
    default:
      return null
  }
}

function getBuilderLoadingKind(pathname: string) {
  if (pathname === '/builder' || pathname === '/builder/') return 'index'
  if (pathname === '/builder/ai') return 'ai'
  if (pathname === '/builder/new') return 'draft'
  if (pathname === '/builder/esbuild' || pathname.startsWith('/builder/p/')) {
    return 'embedded'
  }
  if (pathname.startsWith('/builder/') && pathname !== '/builder/llms.txt') {
    return 'editor'
  }
  return null
}

export function BuilderEmbeddedSkeleton() {
  return (
    <main
      data-builder-loading="embedded"
      aria-busy="true"
      className="min-h-[calc(100dvh-var(--navbar-height))] w-full bg-background-default p-3 text-text-primary sm:p-4"
    >
      <span className="sr-only" role="status">
        Loading builder
      </span>
      <header className="mb-3" aria-hidden="true">
        <SkeletonBlock className="h-5 w-48 max-w-full" />
        <SkeletonBlock className="mt-2 h-4 w-72 max-w-full" />
      </header>
      <BuilderWorkbenchSkeleton />
    </main>
  )
}

export function BuilderListSkeletonRows({
  actions = false,
  count = 3,
}: {
  actions?: boolean
  count?: number
}) {
  return Array.from({ length: count }, (_, index) => (
    <div
      key={index}
      className="flex min-h-20 items-center gap-5 border-b border-border-default px-1 py-5 last:border-b-0 sm:px-3"
    >
      <div className="min-w-0 flex-1">
        <SkeletonBlock className="h-4 w-44 max-w-[70%]" />
        <SkeletonBlock className="mt-2 h-3 w-72 max-w-[90%]" />
      </div>
      {actions ? <SkeletonBlock className="h-8 w-24 rounded-md" /> : null}
    </div>
  ))
}

function BuilderWorkbenchSkeleton({
  assistant = false,
  fullscreen = false,
}: {
  assistant?: boolean
  fullscreen?: boolean
}) {
  if (!assistant) {
    return <LegacyBuilderWorkbenchSkeleton fullscreen={fullscreen} />
  }

  return (
    <section
      aria-hidden="true"
      className={`sandbox-ui @container not-prose relative flex min-w-0 flex-col overflow-hidden bg-background-default ${
        fullscreen
          ? 'min-h-0 flex-1 rounded-none'
          : 'h-[clamp(520px,75dvh,720px)] rounded-lg border border-border-default'
      }`}
    >
      {assistant ? (
        <div className="relative z-10 shrink-0 @min-[900px]:absolute @min-[900px]:top-0 @min-[900px]:right-0 @min-[900px]:w-[62%]">
          <WorkspaceTabSkeleton />
        </div>
      ) : null}
      <div
        className={`grid min-h-0 min-w-0 flex-1 grid-cols-1 ${
          assistant
            ? 'grid-rows-[minmax(0,1fr)_minmax(0,1fr)] @min-[900px]:grid-cols-[minmax(280px,38fr)_minmax(0,62fr)] @min-[900px]:grid-rows-1'
            : 'grid-rows-1'
        }`}
      >
        <PreviewWorkspaceSkeleton assistant={assistant} tabBar={!assistant} />
        {assistant ? <ChatSkeleton /> : null}
      </div>
    </section>
  )
}

function LegacyBuilderWorkbenchSkeleton({
  fullscreen,
}: {
  fullscreen: boolean
}) {
  return (
    <section
      aria-hidden="true"
      className={`sandbox-ui not-prose flex min-w-0 flex-col overflow-hidden bg-background-default ${
        fullscreen
          ? 'min-h-0 flex-1 rounded-none'
          : 'h-[clamp(520px,75dvh,720px)] rounded-lg border border-border-default'
      }`}
    >
      <header className="flex min-h-10 shrink-0 items-center justify-between gap-3 border-b border-border-default px-2">
        <div className="flex min-w-0 items-center gap-2">
          <SkeletonBlock className="size-8 shrink-0 rounded-md" />
          <SkeletonBlock className="h-3 w-24" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SkeletonBlock className="hidden h-3 w-16 sm:block" />
          <SkeletonBlock className="h-7 w-24 rounded-md" />
        </div>
      </header>

      <div className="shrink-0 border-b border-border-default p-1 lg:hidden">
        <div className="grid h-7 grid-cols-2 rounded-md border border-border-default text-center text-xs text-text-muted">
          <span className="flex items-center justify-center">Preview</span>
          <span className="flex items-center justify-center border-l border-border-default">
            Code
          </span>
        </div>
      </div>

      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(280px,67fr)_8px_minmax(280px,33fr)]">
        <div className="hidden min-h-0 min-w-0 border-r border-border-default lg:flex">
          <CodeSkeleton />
        </div>
        <div className="hidden border-x border-border-default lg:block" />
        <div className="min-h-0 min-w-0 bg-background-default">
          <div className="flex h-10 items-center gap-1 border-b border-border-default bg-background-subtle px-1.5 lg:h-9">
            <SkeletonBlock className="size-7 rounded-md" />
            <SkeletonBlock className="size-7 rounded-md" />
            <SkeletonBlock className="size-7 rounded-md" />
            <SkeletonBlock className="mx-1 h-7 min-w-0 flex-1 rounded-lg" />
            <SkeletonBlock className="size-7 rounded-md" />
          </div>
        </div>
      </div>
    </section>
  )
}

function WorkspaceTabSkeleton() {
  return (
    <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border-default bg-background-default p-1">
      <div
        data-builder-tab-skeleton="preview"
        className="corner-squircle flex h-7 min-w-0 items-center gap-2 rounded-lg bg-surface-state-hover px-2.5 text-[13px] font-medium text-text-primary"
      >
        <span className="truncate">Preview</span>
        <SkeletonBlock className="size-2.5 shrink-0 rounded-full" />
      </div>
      <span className="corner-squircle inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-transparent text-text-primary">
        <PlusIcon className="size-3.5" aria-hidden="true" />
      </span>
    </div>
  )
}

function PreviewWorkspaceSkeleton({
  assistant,
  tabBar,
}: {
  assistant: boolean
  tabBar: boolean
}) {
  return (
    <div
      data-builder-workspace-skeleton=""
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden ${
        assistant
          ? 'border-b border-border-default @min-[900px]:order-2 @min-[900px]:border-b-0 @min-[900px]:border-l @min-[900px]:pt-9'
          : ''
      }`}
    >
      {tabBar ? <WorkspaceTabSkeleton /> : null}

      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border-default bg-background-subtle px-1.5 @min-[900px]:h-9">
        <SkeletonBlock className="size-7 rounded-md" />
        <SkeletonBlock className="size-7 rounded-md" />
        <SkeletonBlock className="size-7 rounded-md" />
        <SkeletonBlock className="mx-1 h-7 min-w-0 flex-1 rounded-lg" />
        <SkeletonBlock className="size-7 rounded-md" />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden bg-background-default p-4 sm:p-6">
        <div className="mx-auto w-full max-w-2xl">
          <SkeletonBlock className="h-5 w-40 max-w-[66.666667%]" />
          <SkeletonBlock className="mt-4 h-3 w-full" />
          <SkeletonBlock className="mt-2 h-3 w-4/5" />
          <div className="mt-6 grid grid-cols-3 gap-3">
            <SkeletonBlock className="h-16 rounded-lg" />
            <SkeletonBlock className="h-16 rounded-lg" />
            <SkeletonBlock className="h-16 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}

function ChatSkeleton() {
  return (
    <div
      data-builder-chat-skeleton=""
      className="relative flex min-h-0 min-w-0 flex-col bg-background-default @min-[900px]:order-1"
    >
      <div
        data-builder-chat-controls-skeleton=""
        className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-3 @min-[900px]:p-2"
      >
        <SkeletonBlock className="size-7 rounded-full bg-background-elevated shadow-sm" />
        <div className="flex gap-1">
          <SkeletonBlock className="size-7 rounded-full bg-background-elevated shadow-sm" />
          <SkeletonBlock className="size-7 rounded-full bg-background-elevated shadow-sm" />
          <SkeletonBlock className="size-7 rounded-full bg-background-elevated shadow-sm" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-4 pt-12 pb-4 sm:px-5">
        <SkeletonBlock className="ml-auto h-8 w-2/3 rounded-2xl" />
        <SkeletonBlock className="mt-4 h-3 w-4/5" />
        <SkeletonBlock className="mt-2 h-3 w-3/5" />
      </div>
      <div className="shrink-0 border-t border-border-default p-3">
        <div className="h-16 rounded-2xl border border-border-default bg-background-surface p-3">
          <SkeletonBlock className="h-3 w-3/4" />
          <SkeletonBlock className="mt-3 ml-auto size-6 rounded-full" />
        </div>
      </div>
    </div>
  )
}

function CodeSkeleton() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 bg-background-default">
      <div className="hidden w-[184px] shrink-0 border-r border-border-default p-3 sm:block">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="mt-4 h-3 w-28" />
        <SkeletonBlock className="mt-3 h-3 w-20" />
      </div>
      <div className="min-w-0 flex-1 p-4">
        <SkeletonBlock className="h-3 w-3/5" />
        <SkeletonBlock className="mt-3 h-3 w-4/5" />
        <SkeletonBlock className="mt-3 h-3 w-2/5" />
        <SkeletonBlock className="mt-6 h-3 w-3/4" />
        <SkeletonBlock className="mt-3 h-3 w-1/2" />
      </div>
    </div>
  )
}

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div
      className={`motion-safe:animate-pulse rounded bg-background-subtle ${className}`}
      aria-hidden="true"
    />
  )
}
