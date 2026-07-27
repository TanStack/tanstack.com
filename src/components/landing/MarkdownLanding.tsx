import * as React from 'react'
import { Link, useParams } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { parseMarkdown } from '@tanstack/markdown/parser'
import { renderDocument, renderHtml } from '@tanstack/markdown/html'
import { Markdown } from '@tanstack/markdown/react'
import { streamingMarkdownExtension } from '@tanstack/markdown/extensions/streaming'
import {
  ArrowRight,
  BookOpen,
  Braces,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  Highlighter,
  LockKeyhole,
  PackageOpen,
  Pause,
  Play,
  Radio,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react'

import { Footer } from '~/components/Footer'
import { LandingCommunitySection } from '~/components/LandingCommunitySection'
import LandingPageGad from '~/components/LandingPageGad'
import { LibraryDownloadsMicro } from '~/components/LibraryDownloadsMicro'
import { LibraryWordmark } from '~/components/LibraryWordmark'
import { SponsorSection } from '~/components/SponsorSection'
import { GithubIcon } from '~/components/icons/GithubIcon'
import { getLibrary } from '~/libraries'
import { copyTextToClipboard } from '~/utils/browser-effects'

import { LandingCopyPromptButton } from './LandingCopyPromptButton'

const library = getLibrary('markdown')
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
  const { version } = useParams({ strict: false })
  const resolvedVersion = version ?? library.latestVersion

  return (
    <div className="w-full min-w-0 overflow-x-hidden bg-[#f7f2f8] text-[#201725] dark:bg-[#100b12] dark:text-[#f8f2fa]">
      <section className="relative overflow-hidden border-b border-violet-950/10 bg-[#eee5f2] dark:border-violet-200/10 dark:bg-[#170f1b]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(91,33,182,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(91,33,182,0.055)_1px,transparent_1px)] bg-[size:32px_32px] dark:opacity-40" />
        <div className="relative mx-auto grid w-full gap-10 px-4 py-10 lg:max-w-[80rem] lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:py-16 xl:max-w-[92rem]">
          <div className="max-w-3xl">
            <Eyebrow>
              <FileText size={14} aria-hidden="true" /> A document engine for
              technical publishing
            </Eyebrow>

            <div className="mt-5 flex flex-wrap items-start gap-3">
              <h1 className="text-5xl font-black leading-[0.93] sm:text-6xl lg:text-7xl">
                <LibraryWordmark library={library} />
              </h1>
              {library.badge ? (
                <span className="rounded-sm bg-[#201725] px-2 py-1 text-xs font-black uppercase text-white dark:bg-white dark:text-[#201725]">
                  {library.badge}
                </span>
              ) : null}
            </div>

            <p className="mt-6 max-w-2xl text-2xl font-black leading-tight sm:text-3xl">
              Markdown with an exit strategy.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-700 dark:text-zinc-300 sm:text-lg">
              Parse documents or accumulated AI output into a plain,
              serializable tree. Inspect it, cache it, index it, or render it as
              HTML, React, or Octane—without carrying a content framework or
              incremental parser state through your app.
            </p>

            <LibraryDownloadsMicro
              animateIncreaseTrend
              library={library}
              className="mt-5"
              label="weekly downloads"
              period="weekly"
              showTotals
            />

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                to="/$libraryId/$version/docs"
                params={{ libraryId: library.id, version: resolvedVersion }}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-violet-700 bg-violet-700 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-violet-800 dark:border-violet-400 dark:bg-violet-400 dark:text-violet-950 dark:hover:bg-violet-300"
              >
                <BookOpen size={16} aria-hidden="true" /> Read the syntax
                profile
              </Link>
              <LandingCopyPromptButton
                prompt={markdownPrompt}
                label="Copy Markdown Prompt"
              />
            </div>

            <InstallCommand className="mt-4" />

            <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3 border-t border-violet-950/15 pt-4 font-mono text-xs font-bold uppercase tracking-wider text-violet-900/70 dark:border-violet-200/15 dark:text-violet-200/70">
              <span>4.9 KB parser</span>
              <span>0 runtime dependencies</span>
              <span>1 public AST</span>
            </div>
          </div>

          <ManuscriptPanel />
        </div>
      </section>

      <section className="border-b border-violet-950/10 bg-[#e8dcec] text-[#201725] dark:border-violet-200/10 dark:bg-[#0b080d] dark:text-white">
        <div className="mx-auto w-full px-4 py-14 lg:max-w-[80rem] xl:max-w-[92rem]">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
            <div className="max-w-xl">
              <DarkEyebrow>
                <Braces size={14} aria-hidden="true" /> The durable layer
              </DarkEyebrow>
              <h2 className="mt-4 text-4xl font-black leading-[1.02] sm:text-5xl">
                The AST is the product.
              </h2>
              <p className="mt-5 text-base leading-7 text-violet-950/65 dark:text-violet-100/75 sm:text-lg">
                Parsing does not trap your content inside a renderer. Edit the
                source and inspect the real serializable tree, deterministic
                HTML, or React output below.
              </p>
            </div>

            <div className="grid grid-cols-3 border-y border-violet-950/15 py-4 font-mono dark:border-violet-200/15">
              <WorkbenchStat value="1 parse" label="every output" />
              <WorkbenchStat value="plain JSON" label="cache and index" />
              <WorkbenchStat value="0 deps" label="runtime core" />
            </div>
          </div>

          <MarkdownWorkbench />
        </div>
      </section>

      <section className="border-b border-violet-950/10 bg-white dark:border-violet-200/10 dark:bg-[#100b12]">
        <div className="mx-auto grid w-full gap-10 px-4 py-14 lg:max-w-[80rem] lg:grid-cols-[0.68fr_1.32fr] lg:items-center xl:max-w-[92rem]">
          <div className="max-w-xl">
            <Eyebrow>
              <Radio size={14} aria-hidden="true" /> Accumulated AI responses
            </Eyebrow>
            <h2 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
              Stream the text. Keep the parser stateless.
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-300 sm:text-lg">
              Append each chunk and pass the complete string back through
              TanStack Markdown. The optional streaming profile reparses
              synchronously, so there is no incremental state to coordinate,
              recover, or discard.
            </p>

            <div className="mt-7 border-y border-violet-950/10 font-mono text-xs dark:border-violet-200/10">
              <StreamingProof value="+0.2 KB" label="added to the React path" />
              <StreamingProof
                value="Every prefix"
                label="deterministic React / HTML parity"
              />
              <StreamingProof
                value="Same defaults"
                label="HTML escaped, executable URLs removed"
              />
            </div>

            <pre className="mt-6 overflow-auto rounded-md border border-violet-950/10 bg-[#f7f2f8] p-4 font-mono text-xs leading-6 !text-violet-950/70 dark:border-violet-200/10 dark:bg-white/5 dark:!text-violet-100/70 [&_code]:!text-inherit">
              <code>{`import { streamingMarkdownExtension } from '@tanstack/markdown/extensions/streaming'

const extensions = [streamingMarkdownExtension()]

<Markdown extensions={extensions} frontmatter={false} headingIds={false}>
  {responseSoFar}
</Markdown>`}</code>
            </pre>
          </div>

          <StreamingReplay />
        </div>
      </section>

      <section className="border-b border-violet-950/10 bg-[#fffaf0] dark:border-violet-200/10 dark:bg-[#17110d]">
        <div className="mx-auto grid w-full gap-10 px-4 py-14 lg:max-w-[80rem] lg:grid-cols-[0.72fr_1.28fr] xl:max-w-[92rem]">
          <div className="max-w-xl">
            <Eyebrow>
              <FileText size={14} aria-hidden="true" /> A deliberate profile
            </Eyebrow>
            <h2 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
              It does less Markdown on purpose.
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-300">
              Technical docs need a known vocabulary, not an open-ended compiler
              platform. New syntax has to justify its bytes, its ambiguity, and
              its long-term maintenance cost.
            </p>

            <div className="mt-7 border-l-4 border-violet-600 pl-5">
              <div className="font-mono text-4xl font-black text-violet-700 dark:text-violet-300">
                287 / 652
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                Current CommonMark example accounting. Full conformance is
                explicitly not the goal; the supported docs profile is.
              </p>
            </div>
          </div>

          <div className="grid overflow-hidden border border-violet-950/15 bg-white shadow-sm dark:border-violet-200/10 dark:bg-[#110c13] md:grid-cols-2">
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
      </section>

      <section className="border-b border-violet-950/10 bg-white dark:border-violet-200/10 dark:bg-[#100b12]">
        <div className="mx-auto w-full px-4 py-14 lg:max-w-[80rem] xl:max-w-[92rem]">
          <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
            <div className="max-w-xl">
              <Eyebrow>
                <ShieldCheck size={14} aria-hidden="true" /> Boundary behavior
              </Eyebrow>
              <h2 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
                Unsafe surprises are opt-in.
              </h2>
              <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-300">
                Raw HTML starts escaped, executable URL schemes are stripped,
                and text, attributes, and code are encoded at render time. The
                parser is also tested against malformed and adversarial input as
                part of its normal release gates.
              </p>
            </div>
            <SafetyProof />
          </div>
        </div>
      </section>

      <section className="border-b border-violet-950/10 bg-[#eee5f2] dark:border-violet-200/10 dark:bg-[#170f1b]">
        <div className="mx-auto grid w-full gap-10 px-4 py-14 lg:max-w-[80rem] lg:grid-cols-[0.72fr_1.28fr] xl:max-w-[92rem]">
          <div className="max-w-xl">
            <Eyebrow>
              <PackageOpen size={14} aria-hidden="true" /> Size ledger
            </Eyebrow>
            <h2 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
              A parser should not outweigh the page.
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-300">
              Split entry points keep the parser, renderers, framework adapters,
              and docs extensions independent. Import the layer the page needs.
            </p>
            <p className="mt-5 font-mono text-xs leading-5 text-zinc-500 dark:text-zinc-500">
              Gzip sizes from the project benchmark report. Package scopes and
              feature sets are not equivalent.
            </p>
          </div>
          <BundleLedger />
        </div>
      </section>

      <section className="border-b border-violet-950/10 bg-[#e8dcec] text-[#201725] dark:border-violet-200/10 dark:bg-[#0b080d] dark:text-white">
        <div className="mx-auto grid w-full gap-10 px-4 py-14 lg:max-w-[80rem] lg:grid-cols-[1.1fr_0.9fr] lg:items-center xl:max-w-[92rem]">
          <div>
            <DarkEyebrow>
              <Highlighter size={14} aria-hidden="true" /> Content, then color
            </DarkEyebrow>
            <h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight sm:text-4xl">
              Syntax highlighting stays outside the parser.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-violet-950/65 dark:text-violet-100/75">
              Code fences carry language and metadata. An explicit highlighter
              can render them later, so the core never silently imports a
              grammar engine. The same boundary works with your own highlighter
              or TanStack Highlight.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 font-mono text-xs text-violet-950/65 dark:text-violet-100/75">
              <span className="border border-violet-950/15 px-3 py-2 dark:border-violet-300/20">
                callouts · 0.4 KB
              </span>
              <span className="border border-violet-950/15 px-3 py-2 dark:border-violet-300/20">
                docs preset · 2.4 KB
              </span>
              <span className="border border-violet-950/15 px-3 py-2 dark:border-violet-300/20">
                heading collection
              </span>
            </div>
          </div>

          <Link
            to="/$libraryId"
            params={{ libraryId: highlightLibrary.id }}
            className="group border border-violet-950/15 bg-white/35 p-6 transition-colors hover:bg-white/60 dark:border-violet-300/20 dark:bg-violet-300/5 dark:hover:bg-violet-300/10"
          >
            <div className="font-mono text-xs font-bold uppercase tracking-widest text-violet-700 dark:text-violet-300">
              Companion, not dependency
            </div>
            <div className="mt-4 text-2xl font-black">
              <LibraryWordmark library={highlightLibrary} />
            </div>
            <p className="mt-3 text-sm leading-6 text-violet-950/60 dark:text-violet-100/65">
              Tiny, synchronous highlighting for the code fences your document
              model already understands.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 text-sm font-black">
              Explore Highlight
              <ArrowRight
                size={16}
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-1"
              />
            </div>
          </Link>
        </div>
      </section>

      <section className="bg-white py-14 dark:bg-[#100b12]">
        <div className="mx-auto w-full max-w-[80rem] px-4 xl:max-w-[92rem]">
          <Eyebrow>
            <GithubIcon className="h-3.5 w-3.5" /> Open source, in public
          </Eyebrow>
          <h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight sm:text-4xl">
            A small document contract deserves careful stewardship.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-700 dark:text-zinc-300">
            Syntax fixtures, renderer parity, deterministic corpus checks, size
            budgets, and resilience limits ship with the library—not as an
            afterthought.
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-14">
          <LandingCommunitySection libraryId="markdown" />
          <SponsorSection
            title="GitHub Sponsors"
            aspectRatio="1/1"
            packMaxWidth="900px"
            showCTA
          />
        </div>
      </section>

      <LandingPageGad />
      <section className="border-y border-violet-950/10 bg-[#eee5f2] px-4 py-14 text-center dark:border-violet-200/10 dark:bg-[#170f1b]">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-violet-700 dark:text-violet-300">
          Keep the source. Own the model.
        </p>
        <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-black sm:text-4xl">
          Build your document pipeline on plain data.
        </h2>
        <Link
          to="/$libraryId/$version/docs"
          params={{ libraryId: library.id, version: resolvedVersion }}
          className="mt-7 inline-flex items-center gap-2 rounded-md bg-violet-700 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-violet-800 dark:bg-violet-400 dark:text-violet-950 dark:hover:bg-violet-300"
        >
          Start with the parser <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>
      <Footer />
    </div>
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
    <div className="relative min-w-0 pb-4 pr-0 sm:pr-5">
      <div className="absolute bottom-0 right-0 top-5 hidden w-[92%] border border-violet-950/10 bg-violet-200/50 sm:block dark:border-violet-200/10 dark:bg-violet-950/30" />
      <div className="relative overflow-hidden border border-violet-950/15 bg-[#fffdf8] shadow-[0_18px_50px_rgba(67,36,75,0.12)] dark:border-violet-200/15 dark:bg-[#141016] dark:shadow-black/30">
        <div className="flex items-center justify-between border-b border-violet-950/10 px-4 py-3 font-mono text-[11px] font-bold uppercase tracking-widest text-violet-900/55 dark:border-violet-200/10 dark:text-violet-200/55">
          <span>article.md</span>
          <span>{document.children.length} blocks / live</span>
        </div>
        <div className="grid md:grid-cols-[0.9fr_1.1fr]">
          <pre className="max-h-[24rem] overflow-auto border-b border-violet-950/10 p-5 font-mono text-xs leading-7 !text-zinc-700 md:border-b-0 md:border-r dark:border-violet-200/10 dark:!text-zinc-300 sm:text-sm [&_code]:!text-inherit">
            <code>{heroSource}</code>
          </pre>
          <div className="flex min-h-[18rem] min-w-0 flex-col md:min-h-[24rem]">
            <div className="min-h-0 flex-1 overflow-auto p-5">
              {mode === 'ast' ? (
                <div className="font-mono text-xs leading-6">
                  <div className="text-fuchsia-700 dark:text-fuchsia-300">
                    root{' '}
                    <span className="text-zinc-400">
                      · {document.children.length} blocks
                    </span>
                  </div>
                  <div className="pl-4 text-violet-700 dark:text-violet-300">
                    frontmatter{' '}
                    <span className="text-zinc-400">
                      · {document.frontmatter ? 'string' : 'none'}
                    </span>
                  </div>
                  {document.children.map((node, index) => (
                    <div key={index} className="pl-4">
                      <span className="text-violet-700 dark:text-violet-300">
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
              className="grid grid-cols-3 border-t border-violet-950/10 text-center font-mono text-[10px] font-bold uppercase tracking-wider dark:border-violet-200/10"
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
                      ? 'bg-violet-700 text-white dark:bg-violet-300 dark:text-violet-950'
                      : 'text-violet-800 hover:bg-violet-950/5 dark:text-violet-300 dark:hover:bg-violet-200/5'
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
    <div className="mt-9 overflow-hidden rounded-lg border border-violet-950/15 bg-[#fffdf8] shadow-[0_18px_50px_rgba(67,36,75,0.1)] dark:border-violet-200/15 dark:bg-[#141016] dark:shadow-black/30">
      <div className="flex flex-col justify-between gap-3 border-b border-violet-950/10 px-4 py-3 dark:border-violet-200/10 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1.5" aria-label="Example documents">
          {workbenchPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={activePreset === preset.id}
              className={`rounded-md px-3 py-1.5 font-mono text-[11px] font-bold transition-colors ${
                activePreset === preset.id
                  ? 'bg-violet-700 text-white dark:bg-violet-300 dark:text-violet-950'
                  : 'bg-violet-950/5 text-violet-950/65 hover:bg-violet-950/10 dark:bg-violet-200/5 dark:text-violet-100/65 dark:hover:bg-violet-200/10'
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
        <div className="flex h-[28rem] min-w-0 flex-col border-b border-violet-950/10 lg:h-[34rem] lg:border-b-0 lg:border-r dark:border-violet-200/10">
          <div className="flex items-center justify-between border-b border-violet-950/10 px-4 py-3 font-mono text-[11px] font-bold uppercase tracking-widest text-violet-900/55 dark:border-violet-200/10 dark:text-violet-200/55">
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
          <div className="flex flex-col justify-between gap-2 border-b border-violet-950/10 px-4 py-2 dark:border-violet-200/10 sm:flex-row sm:items-center">
            <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-violet-900/55 dark:text-violet-200/55">
              One document, three views
            </span>
            <div
              className="flex rounded-md bg-violet-950/5 p-1 dark:bg-violet-200/5"
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
                      ? 'bg-white text-violet-800 shadow-sm dark:bg-violet-300 dark:text-violet-950'
                      : 'text-violet-950/55 hover:text-violet-950 dark:text-violet-100/55 dark:hover:text-white'
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
              <article className="prose prose-zinc max-w-none dark:prose-invert prose-headings:font-black prose-h1:text-3xl prose-a:text-violet-700 dark:prose-a:text-violet-300 prose-pre:overflow-auto prose-pre:rounded-md prose-pre:bg-zinc-950 prose-pre:text-zinc-100 [&_pre_code]:!text-zinc-100">
                <Markdown>{document}</Markdown>
              </article>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-2 border-t border-violet-950/10 px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-wider text-violet-950/45 dark:border-violet-200/10 dark:text-violet-100/45 sm:flex-row">
        <span>{nodeCount} typed nodes</span>
        <span>{source.length} source characters</span>
        <span>JSON serializable</span>
      </div>
    </div>
  )
}

function WorkbenchStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-3 text-center first:pl-0 last:pr-0 [&+&]:border-l [&+&]:border-violet-950/10 dark:[&+&]:border-violet-200/10">
      <div className="text-sm font-black text-violet-800 dark:text-violet-300 sm:text-base">
        {value}
      </div>
      <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-violet-950/45 dark:text-violet-100/45 sm:text-[10px]">
        {label}
      </div>
    </div>
  )
}

function StreamingProof({ value, label }: { value: string; label: string }) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-baseline gap-4 py-3 [&+&]:border-t [&+&]:border-violet-950/10 dark:[&+&]:border-violet-200/10">
      <span className="font-black text-violet-800 dark:text-violet-300">
        {value}
      </span>
      <span className="text-right text-violet-950/55 dark:text-violet-100/55">
        {label}
      </span>
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
    <div className="min-w-0 overflow-hidden rounded-lg border border-violet-950/15 bg-[#f7f2f8] shadow-sm dark:border-violet-200/15 dark:bg-[#141016]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-950/10 px-4 py-3 dark:border-violet-200/10">
        <div className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-widest text-violet-950/50 dark:text-violet-100/50">
          <span
            className={`size-2 rounded-full ${
              isPlaying && !isComplete
                ? 'animate-pulse bg-fuchsia-600 motion-reduce:animate-none dark:bg-fuchsia-400'
                : 'bg-violet-950/25 dark:bg-violet-100/25'
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
          className="inline-flex items-center gap-2 rounded-md border border-violet-700/20 bg-white px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-wider text-violet-800 transition-colors hover:border-violet-700/40 hover:bg-violet-50 dark:border-violet-300/20 dark:bg-white/5 dark:text-violet-200 dark:hover:border-violet-300/40 dark:hover:bg-white/10"
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
        <div className="min-w-0 border-b border-violet-950/10 md:border-b-0 md:border-r dark:border-violet-200/10">
          <div className="border-b border-violet-950/10 px-4 py-3 font-mono text-[10px] font-black uppercase tracking-widest text-violet-700 dark:border-violet-200/10 dark:text-violet-300">
            Accumulated source
          </div>
          <pre className="h-[22rem] overflow-auto !whitespace-pre-wrap break-words [overflow-wrap:anywhere] p-4 font-mono text-xs leading-6 !text-zinc-700 dark:!text-zinc-300 [&_code]:!whitespace-pre-wrap [&_code]:[overflow-wrap:anywhere] [&_code]:!text-inherit">
            <code>
              {visibleSource}
              {!isComplete ? (
                <span className="text-fuchsia-600 dark:text-fuchsia-400">
                  ▋
                </span>
              ) : null}
            </code>
          </pre>
        </div>

        <div className="min-w-0">
          <div className="border-b border-violet-950/10 px-4 py-3 font-mono text-[10px] font-black uppercase tracking-widest text-violet-700 dark:border-violet-200/10 dark:text-violet-300">
            React output
          </div>
          <div className="h-[22rem] overflow-auto p-4">
            {visibleSource ? (
              <article className="prose prose-zinc max-w-none dark:prose-invert prose-headings:font-black prose-h1:text-2xl prose-a:text-violet-700 dark:prose-a:text-violet-300 prose-pre:overflow-auto prose-pre:rounded-md prose-pre:bg-zinc-950 prose-pre:text-zinc-100 [&_pre_code]:!text-zinc-100">
                <Markdown>{document}</Markdown>
              </article>
            ) : (
              <p className="font-mono text-xs text-violet-950/40 dark:text-violet-100/40">
                Waiting for the first chunk…
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-violet-950/10 px-4 py-3 dark:border-violet-200/10">
        <div className="h-1 overflow-hidden bg-violet-950/10 dark:bg-violet-200/10">
          <div
            className="h-full bg-fuchsia-600 transition-[width] duration-75 ease-linear motion-reduce:transition-none dark:bg-fuchsia-400"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between gap-4 font-mono text-[10px] font-bold uppercase tracking-wider text-violet-950/40 dark:text-violet-100/40">
          <span>Complete input, reparsed</span>
          <span>
            {characterCount} / {streamingSource.length} chars
          </span>
        </div>
      </div>
    </div>
  )
}

function InstallCommand({ className }: { className?: string }) {
  const [status, setStatus] = React.useState('idle')
  const command = 'pnpm add @tanstack/markdown'

  React.useEffect(() => {
    if (status !== 'copied' && status !== 'error') {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setStatus('idle')
    }, 1800)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [status])

  return (
    <button
      type="button"
      className={`${className ?? ''} inline-flex max-w-full items-center gap-3 rounded-md border border-violet-950/10 bg-white/55 px-3 py-2 text-left font-mono text-xs font-bold text-violet-950/70 transition-colors hover:border-violet-700/30 hover:bg-white dark:border-violet-200/10 dark:bg-white/5 dark:text-violet-100/70 dark:hover:border-violet-300/30 dark:hover:bg-white/10`}
      aria-label="Copy install command"
      onClick={async () => {
        try {
          await copyTextToClipboard(command)
          setStatus('copied')
        } catch {
          setStatus('error')
        }
      }}
    >
      <span className="text-fuchsia-700 dark:text-fuchsia-300">$</span>
      <code className="truncate">{command}</code>
      <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-[10px] uppercase tracking-wider text-violet-900/45 dark:text-violet-100/45">
        {status === 'copied' ? (
          <>
            <CheckCircle2 size={13} aria-hidden="true" /> Copied
          </>
        ) : status === 'error' ? (
          'Copy failed'
        ) : (
          <>
            <Copy size={13} aria-hidden="true" /> Copy
          </>
        )}
      </span>
    </button>
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
    <div className="p-5 md:p-6 [&+&]:border-t [&+&]:border-violet-950/10 dark:[&+&]:border-violet-200/10 md:[&+&]:border-l md:[&+&]:border-t-0">
      <div className="font-mono text-xs font-black uppercase tracking-widest text-violet-700 dark:text-violet-300">
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
    <div className="overflow-hidden rounded-lg border border-violet-950/15 bg-[#fffdf8] shadow-sm dark:border-violet-200/15 dark:bg-[#141016]">
      <div className="grid md:grid-cols-2">
        <div className="min-w-0 border-b border-violet-950/10 md:border-b-0 md:border-r dark:border-violet-200/10">
          <div className="border-b border-violet-950/10 px-4 py-3 font-mono text-[10px] font-black uppercase tracking-widest text-rose-700 dark:border-violet-200/10 dark:text-rose-300">
            Untrusted input
          </div>
          <pre className="overflow-auto !whitespace-pre-wrap break-words [overflow-wrap:anywhere] p-4 font-mono text-xs leading-6 !text-zinc-700 dark:!text-zinc-300 [&_code]:!whitespace-pre-wrap [&_code]:[overflow-wrap:anywhere] [&_code]:!text-inherit">
            <code>{safetySource}</code>
          </pre>
        </div>
        <div className="min-w-0">
          <div className="border-b border-violet-950/10 px-4 py-3 font-mono text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:border-violet-200/10 dark:text-emerald-300">
            Deterministic HTML
          </div>
          <pre className="overflow-auto !whitespace-pre-wrap break-words [overflow-wrap:anywhere] p-4 font-mono text-xs leading-6 !text-zinc-700 dark:!text-zinc-300 [&_code]:!whitespace-pre-wrap [&_code]:[overflow-wrap:anywhere] [&_code]:!text-inherit">
            <code>{html}</code>
          </pre>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-violet-950/10 px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:border-violet-200/10 dark:text-emerald-400">
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
                  ? 'font-black text-violet-800 dark:text-violet-300'
                  : 'text-zinc-600 dark:text-zinc-400'
              }
            >
              {comparison.name}
            </span>
            <span className="font-black">{comparison.size}</span>
          </div>
          <div className="h-2 bg-violet-950/10 dark:bg-violet-200/10">
            <div
              className={`h-full ${comparison.width} ${comparison.emphasis ? 'bg-violet-600' : 'bg-violet-950/30 dark:bg-violet-200/30'}`}
            />
          </div>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-px bg-violet-950/10 pt-px font-mono text-xs dark:bg-violet-200/10 sm:grid-cols-4">
        {[
          ['6.7 KB', 'HTML renderer'],
          ['6.7 KB', 'React adapter'],
          ['6.7 KB', 'Octane adapter'],
          ['2.4 KB', 'docs preset'],
        ].map(([value, label]) => (
          <div key={label} className="bg-[#eee5f2] px-3 py-4 dark:bg-[#170f1b]">
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

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 font-mono text-xs font-black uppercase tracking-widest text-violet-700 dark:text-violet-300">
      {children}
    </div>
  )
}

function DarkEyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 font-mono text-xs font-black uppercase tracking-widest text-violet-700 dark:text-violet-300">
      {children}
    </div>
  )
}
