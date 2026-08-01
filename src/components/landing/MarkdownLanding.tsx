import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { parseMarkdown } from '@tanstack/markdown/parser'
import { renderDocument, renderHtml } from '@tanstack/markdown/html'
import { Markdown } from '@tanstack/markdown/react'
import { streamingMarkdownExtension } from '@tanstack/markdown/extensions/streaming'
import {
  ArrowRight,
  BracketsCurly as Braces,
  Check,
  FileText,
  Highlighter,
  LockKey as LockKeyhole,
  Package as PackageOpen,
  Pause,
  Play,
  Radio,
  ArrowCounterClockwise as RotateCcw,
  ShieldCheck,
  X,
} from '@phosphor-icons/react'

import { LibraryWordmark } from '~/components/LibraryWordmark'
import { getLibrary } from '~/libraries'

import {
  LandingSection,
  LandingSectionIntro,
  LibraryLandingShell,
} from './LibraryLanding'

const highlightLibrary = getLibrary('highlight')

const markdownPrompt = [
  'Build a technical content renderer with TanStack Markdown.',
  'Treat its serializable AST as the durable document model, render from that tree with HTML, React, or Octane, and enable only the syntax extensions the product needs.',
  'For accumulated AI responses, use the optional streaming profile without carrying incremental parser state between updates.',
  'Preserve the safe defaults and deterministic output, and keep syntax highlighting as an explicit external integration.',
].join(' ')

const supportedSyntax = [
  'Headings and emphasis',
  'Lists and task lists',
  'Tables and footnotes',
  'Fenced code with metadata',
  'Links, images, and references',
  'Frontmatter',
]

const deliberateBoundaries = [
  'Every CommonMark edge case',
  'Arbitrary async plugin chains',
  'MDX or JSX evaluation',
  'A bundled highlighter',
  'A general HTML sanitizer',
]

const heroSource = `---
title: Ship the docs
---

# One source

Parse it **once**. Render it where the product needs it.

- cache the tree
- index the text
- choose a renderer`

const workbenchPresets = [
  {
    id: 'docs',
    label: 'Docs page',
    source: `---
title: Durable content
---

# One source, many destinations

Parse the document **once**, then keep the tree.

- cache it at the edge
- index its text
- render it with React or HTML

> The renderer can change. The document does not.`,
  },
  {
    id: 'code',
    label: 'Code fence',
    source: `# Typed examples

Code metadata survives parsing so another layer can decide how it looks.

\`\`\`tsx title="article.tsx" {2}
import { Markdown } from '@tanstack/markdown/react'

export function Article({ source }: { source: string }) {
  return <Markdown>{source}</Markdown>
}
\`\`\``,
  },
  {
    id: 'safety',
    label: 'Unsafe input',
    source: `# Untrusted content

<script>alert("not today")</script>

[Run code](javascript:alert("nope"))

**Trusted Markdown still renders.**`,
  },
]

const safetySource = `<script>alert("not today")</script>

[Run code](javascript:alert("nope"))

**Trusted Markdown still renders.**`

const streamingSource = `# Streaming response

The model can send **ordinary Markdown** as it thinks.

- completed blocks stay stable
- unfinished markers stay out of the way
- React and HTML stay in sync

\`\`\`ts
const text = responseSoFar
return render(text)
\`\`\`

[Unsafe links stay text-only](javascript:alert("nope"))`

const streamingExtensions = [streamingMarkdownExtension()]

const bundleComparisons = [
  {
    name: 'TanStack parser',
    size: '4.9 KB',
    width: 'w-[9%]',
    emphasis: true,
  },
  { name: 'marked', size: '12.5 KB', width: 'w-[24%]', emphasis: false },
  {
    name: 'unified stack',
    size: '36.8 KB',
    width: 'w-[70%]',
    emphasis: false,
  },
  {
    name: 'markdown-it',
    size: '52.7 KB',
    width: 'w-full',
    emphasis: false,
  },
]

export default function MarkdownLanding() {
  return (
    <LibraryLandingShell
      libraryId="markdown"
      headline="Markdown with an exit strategy."
      description="Parse documents or accumulated AI output into a plain, serializable tree. Inspect it, cache it, index it, or render it as HTML, React, or Octane."
      hero={<ManuscriptPanel />}
      prompt={markdownPrompt}
      promptLabel="Copy Markdown prompt"
    >
      <LandingSection tone="accent">
        <LandingSectionIntro
          centered
          eyebrow="The durable layer"
          icon={<Braces aria-hidden="true" size={15} />}
          title="The AST is the product."
          body="Parsing does not trap content inside a renderer. Edit the source and inspect the serializable tree, deterministic HTML, or React output."
        />
        <MarkdownWorkbench />
      </LandingSection>

      <LandingSection tone="ink">
        <div className="grid items-center gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
          <LandingSectionIntro
            eyebrow="Accumulated AI responses"
            icon={<Radio aria-hidden="true" size={15} />}
            title="Stream the text. Keep the parser stateless."
            body="Append each chunk and pass the complete string through Markdown. The optional streaming profile reparses synchronously, with no incremental state to coordinate or recover."
          />
          <StreamingReplay />
        </div>
      </LandingSection>

      <LandingSection tone="raised">
        <div className="grid items-center gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
          <LandingSectionIntro
            eyebrow="A deliberate profile"
            icon={<FileText aria-hidden="true" size={15} />}
            title="It does less Markdown on purpose."
            body="Technical docs need a known vocabulary, not an open-ended compiler platform. New syntax has to justify its bytes, ambiguity, and maintenance cost."
          />
          <div className="grid overflow-hidden rounded-xl border border-border-subtle bg-background-surface md:grid-cols-2">
            <SyntaxList
              title="Inside the profile"
              items={supportedSyntax}
              included
            />
            <SyntaxList
              title="Outside the contract"
              items={deliberateBoundaries}
              included={false}
            />
          </div>
        </div>
        <div className="mt-12 grid items-center gap-12 border-t border-border-subtle pt-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
          <LandingSectionIntro
            eyebrow="Boundary behavior"
            icon={<ShieldCheck aria-hidden="true" size={15} />}
            title="Unsafe surprises are opt-in."
            body="Raw HTML starts escaped, executable URL schemes are stripped, and text, attributes, and code are encoded at render time."
          />
          <SafetyProof />
        </div>
      </LandingSection>

      <LandingSection tone="accent">
        <div className="grid items-center gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
          <LandingSectionIntro
            eyebrow="Size ledger"
            icon={<PackageOpen aria-hidden="true" size={15} />}
            title="A parser should not outweigh the page."
            body="Split entry points keep the parser, renderers, framework adapters, and docs extensions independent. Import only the layer the page needs."
          />
          <BundleLedger />
        </div>
      </LandingSection>

      <LandingSection tone="ink">
        <div className="grid items-center gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
          <LandingSectionIntro
            eyebrow="Content, then color"
            icon={<Highlighter aria-hidden="true" size={15} />}
            title="Syntax highlighting stays outside the parser."
            body="Code fences carry language and metadata. An explicit highlighter renders them later, so the core never silently imports a grammar engine."
          />
          <Link
            to="/$libraryId"
            params={{ libraryId: highlightLibrary.id }}
            className="group rounded-xl border border-border-subtle bg-background-surface p-6 transition-colors hover:border-border-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)]"
          >
            <p className="font-ds-mono text-ds-mono-caps uppercase text-[var(--landing-accent-bright)]">
              Companion, not dependency
            </p>
            <div className="mt-4 text-ds-heading-4">
              <LibraryWordmark library={highlightLibrary} />
            </div>
            <p className="mt-3 text-ds-body-sm text-text-primary/55">
              Synchronous highlighting for the code fences the document model
              already understands.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 text-ds-label-md">
              Explore Highlight
              <ArrowRight
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-1"
                size={16}
              />
            </span>
          </Link>
        </div>
      </LandingSection>
    </LibraryLandingShell>
  )
}

function ManuscriptPanel() {
  const [mode, setMode] = React.useState('ast')
  const document = React.useMemo(
    () => parseMarkdown(heroSource, { frontmatter: true, headingIds: true }),
    [],
  )
  const html = React.useMemo(() => renderDocument(document), [document])

  return (
    <div className="library-landing-graphic min-w-0 overflow-hidden rounded-xl border border-[color:rgb(var(--landing-glow)/0.45)] bg-background-surface shadow-[0_24px_70px_-28px_rgb(var(--landing-glow)/0.45)]">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3 font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/55">
        <span>article.md</span>
        <span>{document.children.length} blocks / live</span>
      </div>
      <div className="grid md:grid-cols-[0.9fr_1.1fr]">
        <pre className="max-h-[24rem] overflow-auto border-b border-border-subtle p-5 font-ds-mono text-ds-mono-xs leading-7 !text-text-secondary md:border-b-0 md:border-r [&_code]:!text-inherit">
          <code>{heroSource}</code>
        </pre>
        <div className="flex min-h-[18rem] min-w-0 flex-col md:min-h-[24rem]">
          <div className="min-h-0 flex-1 overflow-auto p-5">
            {mode === 'ast' ? (
              <div className="font-mono text-xs leading-6">
                <div className="text-[var(--landing-accent-bright)]">
                  root{' '}
                  <span className="text-zinc-400">
                    · {document.children.length} blocks
                  </span>
                </div>
                <div className="pl-4 text-[var(--landing-accent-bright)]">
                  frontmatter{' '}
                  <span className="text-zinc-400">
                    · {document.frontmatter ? 'string' : 'none'}
                  </span>
                </div>
                {document.children.map((node, index) => (
                  <div key={index} className="pl-4">
                    <span className="text-[var(--landing-accent-bright)]">
                      {node.type}
                    </span>
                    <span className="text-zinc-400">
                      {' '}
                      ·{' '}
                      {node.type === 'heading'
                        ? `depth: ${node.depth}`
                        : node.type === 'list'
                          ? `${node.items.length} items`
                          : node.type === 'paragraph'
                            ? `${node.children.length} inline nodes`
                            : 'block'}
                    </span>
                  </div>
                ))}
              </div>
            ) : mode === 'html' ? (
              <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-6 !text-zinc-700 dark:!text-zinc-300 [&_code]:!text-inherit">
                <code>{html}</code>
              </pre>
            ) : (
              <div className="prose prose-zinc max-w-none text-sm dark:prose-invert prose-headings:font-black prose-h1:text-2xl prose-p:leading-6">
                <Markdown>{document}</Markdown>
              </div>
            )}
          </div>
          <div
            className="grid grid-cols-3 border-t border-border-subtle text-center font-ds-mono text-ds-mono-caps-xs uppercase"
            role="tablist"
            aria-label="Hero output"
          >
            {[
              ['ast', 'AST'],
              ['html', 'HTML'],
              ['react', 'React'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                className={`px-2 py-4 transition-colors ${
                  mode === id
                    ? 'bg-[var(--landing-accent)] text-[var(--landing-accent-ink)]'
                    : 'text-text-primary/55 hover:bg-text-primary/5 hover:text-text-primary'
                }`}
                onClick={() => setMode(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function MarkdownWorkbench() {
  const [source, setSource] = React.useState(
    workbenchPresets[0]?.source ?? heroSource,
  )
  const [activePreset, setActivePreset] = React.useState('docs')
  const [mode, setMode] = React.useState('ast')
  const document = React.useMemo(
    () => parseMarkdown(source, { frontmatter: true, headingIds: true }),
    [source],
  )
  const ast = React.useMemo(
    () => JSON.stringify(document, undefined, 2),
    [document],
  )
  const html = React.useMemo(() => renderDocument(document), [document])
  const nodeCount = (ast.match(/"type":/g) ?? []).length

  return (
    <div className="mt-10 overflow-hidden rounded-xl border border-border-subtle bg-background-surface">
      <div className="flex flex-col justify-between gap-3 border-b border-border-subtle px-4 py-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1.5" aria-label="Example documents">
          {workbenchPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={activePreset === preset.id}
              className={`rounded-md px-3 py-1.5 font-mono text-[11px] font-bold transition-colors ${
                activePreset === preset.id
                  ? 'bg-[var(--landing-accent)] text-[var(--landing-accent-ink)]'
                  : 'bg-text-primary/5 text-text-primary/55 hover:bg-text-primary/10 hover:text-text-primary'
              }`}
              onClick={() => {
                setActivePreset(preset.id)
                setSource(preset.source)
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          Parsing locally
        </div>
      </div>

      <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex h-[28rem] min-w-0 flex-col border-b border-border-subtle lg:h-[34rem] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3 font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/55">
            <span>article.md</span>
            <span>editable source</span>
          </div>
          <textarea
            aria-label="Editable Markdown source"
            className="block min-h-0 w-full flex-1 resize-none bg-transparent p-5 font-mono text-xs leading-6 text-zinc-800 outline-none placeholder:text-zinc-400 focus:bg-white/55 dark:text-zinc-200 dark:focus:bg-black/10 sm:text-sm"
            spellCheck={false}
            value={source}
            onChange={(event) => {
              setActivePreset('custom')
              setSource(event.currentTarget.value)
            }}
          />
        </div>

        <div className="flex h-[28rem] min-w-0 flex-col lg:h-[34rem]">
          <div className="flex flex-col justify-between gap-2 border-b border-border-subtle px-4 py-2 sm:flex-row sm:items-center">
            <span className="font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/55">
              One document, three views
            </span>
            <div
              className="flex rounded-md bg-text-primary/5 p-1"
              role="tablist"
              aria-label="Document output"
            >
              {[
                ['ast', 'AST'],
                ['html', 'HTML'],
                ['react', 'React'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={mode === id}
                  className={`rounded px-3 py-1.5 font-mono text-[11px] font-bold transition-colors ${
                    mode === id
                      ? 'bg-[var(--landing-accent)] text-[var(--landing-accent-ink)]'
                      : 'text-text-primary/55 hover:text-text-primary'
                  }`}
                  onClick={() => setMode(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-5" role="tabpanel">
            {mode === 'ast' ? (
              <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-6 !text-zinc-700 dark:!text-zinc-300 [&_code]:!text-inherit">
                <code>{ast}</code>
              </pre>
            ) : mode === 'html' ? (
              <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-6 !text-zinc-700 dark:!text-zinc-300 [&_code]:!text-inherit">
                <code>{html}</code>
              </pre>
            ) : (
              <article className="prose prose-zinc max-w-none dark:prose-invert prose-headings:font-black prose-h1:text-3xl prose-a:text-[var(--landing-accent-bright)] prose-pre:overflow-auto prose-pre:rounded-md prose-pre:bg-zinc-950 prose-pre:text-zinc-100 [&_pre_code]:!text-zinc-100">
                <Markdown>{document}</Markdown>
              </article>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-2 border-t border-border-subtle px-4 py-3 font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/45 sm:flex-row">
        <span>{nodeCount} typed nodes</span>
        <span>{source.length} source characters</span>
        <span>JSON serializable</span>
      </div>
    </div>
  )
}

function StreamingReplay() {
  const [characterCount, setCharacterCount] = React.useState(
    streamingSource.length,
  )
  const [isPlaying, setIsPlaying] = React.useState(false)
  const isComplete = characterCount >= streamingSource.length
  const visibleSource = streamingSource.slice(0, characterCount)
  const document = React.useMemo(
    () =>
      parseMarkdown(visibleSource, {
        extensions: streamingExtensions,
        frontmatter: false,
        headingIds: false,
      }),
    [visibleSource],
  )
  const progress = (characterCount / streamingSource.length) * 100
  const stateLabel = isComplete
    ? 'Complete'
    : isPlaying
      ? 'Streaming'
      : 'Paused'

  React.useEffect(() => {
    if (!isPlaying || isComplete) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setCharacterCount((current) =>
        Math.min(current + 4, streamingSource.length),
      )
    }, 35)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [characterCount, isComplete, isPlaying])

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border-subtle bg-background-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <div className="flex items-center gap-2 font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/50">
          <span
            className={`size-2 rounded-full ${
              isPlaying && !isComplete
                ? 'animate-pulse bg-[var(--landing-accent)] motion-reduce:animate-none'
                : 'bg-text-primary/25'
            }`}
          />
          {stateLabel}
        </div>

        <button
          type="button"
          aria-label={
            isComplete
              ? 'Replay the Markdown stream'
              : isPlaying
                ? 'Pause the Markdown stream'
                : 'Resume the Markdown stream'
          }
          className="inline-flex items-center gap-2 rounded-md border border-border-default bg-background-subtle px-3 py-1.5 font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary transition-colors hover:border-[var(--landing-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)]"
          onClick={() => {
            if (isComplete) {
              setCharacterCount(0)
              setIsPlaying(true)
              return
            }

            setIsPlaying((current) => !current)
          }}
        >
          {isComplete ? (
            <RotateCcw size={13} aria-hidden="true" />
          ) : isPlaying ? (
            <Pause size={13} aria-hidden="true" />
          ) : (
            <Play size={13} aria-hidden="true" />
          )}
          {isComplete ? 'Replay stream' : isPlaying ? 'Pause' : 'Resume'}
        </button>
      </div>

      <div className="grid md:grid-cols-2">
        <div className="min-w-0 border-b border-border-subtle md:border-b-0 md:border-r">
          <div className="border-b border-border-subtle px-4 py-3 font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--landing-accent-bright)]">
            Accumulated source
          </div>
          <pre className="h-[22rem] overflow-auto !whitespace-pre-wrap break-words [overflow-wrap:anywhere] p-4 font-mono text-xs leading-6 !text-zinc-700 dark:!text-zinc-300 [&_code]:!whitespace-pre-wrap [&_code]:[overflow-wrap:anywhere] [&_code]:!text-inherit">
            <code>
              {visibleSource}
              {!isComplete ? (
                <span className="text-[var(--landing-accent-bright)]">▋</span>
              ) : null}
            </code>
          </pre>
        </div>

        <div className="min-w-0">
          <div className="border-b border-border-subtle px-4 py-3 font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--landing-accent-bright)]">
            React output
          </div>
          <div className="h-[22rem] overflow-auto p-4">
            {visibleSource ? (
              <article className="prose prose-zinc max-w-none dark:prose-invert prose-headings:font-black prose-h1:text-2xl prose-a:text-[var(--landing-accent-bright)] prose-pre:overflow-auto prose-pre:rounded-md prose-pre:bg-zinc-950 prose-pre:text-zinc-100 [&_pre_code]:!text-zinc-100">
                <Markdown>{document}</Markdown>
              </article>
            ) : (
              <p className="font-ds-mono text-ds-mono-xs text-text-primary/40">
                Waiting for the first chunk…
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-border-subtle px-4 py-3">
        <div className="h-1 overflow-hidden bg-text-primary/10">
          <div
            className="h-full bg-[var(--landing-accent)] transition-[width] duration-75 ease-linear motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between gap-4 font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/40">
          <span>Complete input, reparsed</span>
          <span>
            {characterCount} / {streamingSource.length} chars
          </span>
        </div>
      </div>
    </div>
  )
}

function SyntaxList({
  included,
  items,
  title,
}: {
  included: boolean
  items: Array<string>
  title: string
}) {
  return (
    <div className="p-5 md:p-6 [&+&]:border-t [&+&]:border-border-subtle md:[&+&]:border-l md:[&+&]:border-t-0">
      <div className="font-ds-mono text-ds-mono-caps uppercase text-[var(--landing-accent-bright)]">
        {title}
      </div>
      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm font-bold">
            {included ? (
              <Check
                size={16}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-emerald-600"
              />
            ) : (
              <X
                size={16}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-zinc-400"
              />
            )}
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function SafetyProof() {
  const html = renderHtml(safetySource)

  return (
    <div className="overflow-hidden rounded-xl border border-border-subtle bg-background-surface">
      <div className="grid md:grid-cols-2">
        <div className="min-w-0 border-b border-border-subtle md:border-b-0 md:border-r">
          <div className="border-b border-border-subtle px-4 py-3 font-ds-mono text-ds-mono-caps-xs uppercase text-rose-700 dark:text-rose-300">
            Untrusted input
          </div>
          <pre className="overflow-auto !whitespace-pre-wrap break-words [overflow-wrap:anywhere] p-4 font-mono text-xs leading-6 !text-zinc-700 dark:!text-zinc-300 [&_code]:!whitespace-pre-wrap [&_code]:[overflow-wrap:anywhere] [&_code]:!text-inherit">
            <code>{safetySource}</code>
          </pre>
        </div>
        <div className="min-w-0">
          <div className="border-b border-border-subtle px-4 py-3 font-ds-mono text-ds-mono-caps-xs uppercase text-emerald-700 dark:text-emerald-300">
            Deterministic HTML
          </div>
          <pre className="overflow-auto !whitespace-pre-wrap break-words [overflow-wrap:anywhere] p-4 font-mono text-xs leading-6 !text-zinc-700 dark:!text-zinc-300 [&_code]:!whitespace-pre-wrap [&_code]:[overflow-wrap:anywhere] [&_code]:!text-inherit">
            <code>{html}</code>
          </pre>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border-subtle px-4 py-3 font-ds-mono text-ds-mono-caps-xs uppercase text-emerald-700 dark:text-emerald-400">
        <span className="inline-flex items-center gap-1.5">
          <LockKeyhole size={12} aria-hidden="true" /> HTML escaped
        </span>
        <span>Executable URL removed</span>
        <span>Markdown preserved</span>
      </div>
    </div>
  )
}

function BundleLedger() {
  return (
    <div className="space-y-4">
      {bundleComparisons.map((comparison) => (
        <div key={comparison.name}>
          <div className="mb-1.5 flex items-center justify-between gap-4 font-mono text-xs">
            <span
              className={
                comparison.emphasis
                  ? 'font-black text-[var(--landing-accent-bright)]'
                  : 'text-text-primary/55'
              }
            >
              {comparison.name}
            </span>
            <span className="font-black">{comparison.size}</span>
          </div>
          <div className="h-2 rounded-full bg-text-primary/10">
            <div
              className={`h-full rounded-full ${comparison.width} ${comparison.emphasis ? 'bg-[var(--landing-accent)]' : 'bg-text-primary/30'}`}
            />
          </div>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border-subtle p-px font-ds-mono text-ds-mono-xs sm:grid-cols-4">
        {[
          ['6.7 KB', 'HTML renderer'],
          ['6.7 KB', 'React adapter'],
          ['6.7 KB', 'Octane adapter'],
          ['2.4 KB', 'docs preset'],
        ].map(([value, label]) => (
          <div key={label} className="bg-background-surface px-3 py-4">
            <div className="font-black">{value}</div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
