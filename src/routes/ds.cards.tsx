import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import { seo } from '~/utils/seo'
import { Tooltip } from '~/ui'
import { Button, Card, InlineCode } from '~/components/ds/ui'
import { BlogPostCard } from '~/components/ds/ui/BlogPostCard'
import {
  ComponentPreview,
  DsPage,
  DsSection,
  PreviewLabel,
} from '~/components/ds/DsKit'

const BLOG_CARD_SAMPLES = [
  {
    slug: 'tanstack-has-a-new-look',
    title: 'TanStack Has a New Look',
    published: '2026-07-29',
    excerpt:
      'TanStack has a new logo, a design system, and a brand built with care for the details.',
    headerImage: '/blog-assets/tanstack-has-a-new-look/logo-swatch.svg',
    authors: ['Tanner Linsley'],
    library: 'table',
  },
  {
    slug: 'introducing-tanstack-markdown-and-highlight',
    title: 'Introducing TanStack Markdown and Highlight',
    published: '2026-07-24',
    excerpt:
      'Two tiny, synchronous libraries for turning technical content into deterministic, themeable webpages.',
    headerImage:
      '/blog-assets/introducing-tanstack-markdown-and-highlight/header.webp',
    authors: ['Tanner Linsley'],
    library: 'markdown,highlight',
  },
]

const BLOG_CARD_SIZES = ['sm', 'lg'] as const

// Consolidated Blog post card preview: pick the variant and both the rendered
// cards and the code snippet update. `sm` (nav/homepage) drops the library tags
// to mirror its `RecentPost` data; `lg` (Blog index) shows them.
function BlogPostCardDemo() {
  const [size, setSize] = React.useState<(typeof BLOG_CARD_SIZES)[number]>('lg')
  const code =
    size === 'lg'
      ? `<BlogPostCard post={post} size="lg" />`
      : `<BlogPostCard post={post} />`

  return (
    <ComponentPreview className="block" code={code}>
      <div className="w-full space-y-6">
        <div className="flex items-center gap-3">
          <PreviewLabel>Variant</PreviewLabel>
          <div
            role="group"
            aria-label="Card size"
            className="inline-flex rounded-lg border border-border-default bg-background-surface p-0.5"
          >
            {BLOG_CARD_SIZES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={size === option}
                onClick={() => setSize(option)}
                className={twMerge(
                  'rounded-md px-3 py-1 font-ds-mono text-ds-mono-caps-xs uppercase transition-colors',
                  size === option
                    ? 'bg-background-subtle text-text-primary'
                    : 'text-text-muted hover:text-text-primary',
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
          {BLOG_CARD_SAMPLES.map((sample) => (
            <BlogPostCard
              key={sample.slug}
              size={size}
              post={{
                ...sample,
                library: size === 'lg' ? sample.library : undefined,
              }}
            />
          ))}
        </div>
      </div>
    </ComponentPreview>
  )
}

export const Route = createFileRoute('/ds/cards')({
  component: CardsPage,
  head: () => ({
    meta: seo({
      title: 'Cards & Surfaces | TanStack Design System',
      description: 'Surface primitives — Card, InlineCode, and Tooltip.',
    }),
  }),
})

function CardsPage() {
  return (
    <DsPage
      title="Cards & Surfaces"
      description="Container and inline primitives that establish elevation and emphasis."
    >
      <DsSection
        title="Card"
        description="A polymorphic surface (render as a link via `as`). Source: src/components/Card.tsx."
      >
        <ComponentPreview
          className="block"
          code={`<Card className="p-5 max-w-sm">
  <h3 className="font-semibold">TanStack Start</h3>
  <p className="text-sm text-gray-500">Full-stack React framework.</p>
</Card>`}
        >
          <Card className="max-w-sm p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              TanStack Start
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Full-stack React framework powered by TanStack Router.
            </p>
            <div className="mt-4">
              <Button size="sm">Learn more</Button>
            </div>
          </Card>
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Inline code"
        description="Emphasizes code references within running text. Source: src/ui/InlineCode.tsx."
      >
        <ComponentPreview
          className="block"
          code={`Run <InlineCode>pnpm dev</InlineCode> to start the server.`}
        >
          <p className="text-gray-900 dark:text-white">
            Run <InlineCode>pnpm dev</InlineCode> to start the dev server, then
            open <InlineCode>localhost:3000</InlineCode>.
          </p>
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Blog post card"
        description="The canonical blog preview. size='sm' (default) is the compact card in the homepage and Blog mega menu; size='lg' is the roomier treatment for the Blog index grid, and renders library tags when the post carries a library. Padding, hover, focus, selected state, typography, media treatment, and metadata are managed here."
      >
        <BlogPostCardDemo />
      </DsSection>

      <DsSection
        title="Tooltip"
        description="Base UI-powered tooltip. Hover or focus the trigger. Source: src/ui/Tooltip.tsx."
      >
        <ComponentPreview
          code={`<Tooltip content="Copied to clipboard">
  <Button variant="secondary">Hover me</Button>
</Tooltip>`}
        >
          <Tooltip content="Copied to clipboard">
            <Button variant="secondary">Hover me</Button>
          </Tooltip>
          <Tooltip content="Appears on the right" side="right">
            <Button variant="ghost">Right side</Button>
          </Tooltip>
        </ComponentPreview>
      </DsSection>
    </DsPage>
  )
}
