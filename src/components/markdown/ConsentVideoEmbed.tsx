import type * as React from 'react'
import { ConsentGate } from '@c15t/tanstack-start'
import { ArrowUpRightIcon } from '@phosphor-icons/react/ArrowUpRight'
import { PlayCircleIcon } from '@phosphor-icons/react/PlayCircle'
import { YoutubeLogoIcon } from '@phosphor-icons/react/YoutubeLogo'
import { Button } from '~/components/ds/ui'
import type { BlockNode, MarkdownDocument } from '@tanstack/markdown'
import { isSafeHttpUrl } from '~/utils/url-boundary'

const videoHosts = [
  {
    name: 'YouTube',
    Icon: YoutubeLogoIcon,
    hosts: ['youtube.com', 'youtube-nocookie.com'],
    watchUrl: (url: URL) => {
      const id = url.pathname.match(/^\/embed\/([\w-]+)/)?.[1]
      return id ? `https://www.youtube.com/watch?v=${id}` : null
    },
  },
  {
    name: 'Vimeo',
    Icon: PlayCircleIcon,
    hosts: ['player.vimeo.com'],
    watchUrl: (url: URL) => {
      const id = url.pathname.match(/^\/video\/(\d+)/)?.[1]
      return id ? `https://vimeo.com/${id}` : null
    },
  },
]

export function getVideoEmbed(src: string | undefined) {
  if (!src) return null

  try {
    const url = new URL(src)
    const host = videoHosts.find((video) =>
      video.hosts.some(
        (name) => url.hostname === name || url.hostname.endsWith(`.${name}`),
      ),
    )
    return host
      ? { provider: host.name, Icon: host.Icon, watchUrl: host.watchUrl(url) }
      : null
  } catch {
    return null
  }
}

const iframeBlockPattern = /^\s*<iframe\s+([\s\S]*?)>\s*<\/iframe>\s*$/i
const iframeAttributePattern =
  /([a-zA-Z][a-zA-Z0-9:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g

/**
 * Markdown renders a raw HTML block as innerHTML, which would load a video
 * iframe without consent. Turn blocks that are a single video iframe into
 * `consent-video-embed` components, as mapChartsCatalogEmbeds does for charts.
 */
export function mapVideoEmbeds(document: MarkdownDocument): MarkdownDocument {
  return {
    ...document,
    children: document.children.map((block) =>
      block.type === 'html' ? (videoEmbedBlock(block.value) ?? block) : block,
    ),
  }
}

function videoEmbedBlock(html: string): BlockNode | undefined {
  const attributeSource = html.match(iframeBlockPattern)?.[1]
  if (!attributeSource) return undefined

  const attributes: Record<string, string> = {}
  for (const [, name, double, single] of attributeSource.matchAll(
    iframeAttributePattern,
  )) {
    if (name) attributes[name.toLowerCase()] = double ?? single ?? ''
  }

  const src = attributes.src?.replaceAll('&amp;', '&')
  if (!src || !isSafeHttpUrl(src) || !getVideoEmbed(src)) return undefined

  return {
    type: 'component',
    name: 'consent-video-embed',
    tagName: 'consent-video-embed',
    attributes: {},
    properties: {
      src,
      title: attributes.title ?? '',
      allow: attributes.allow ?? '',
    },
    children: [],
  }
}

/**
 * A YouTube or Vimeo embed from markdown. The players can set advertising
 * identifiers, so the iframe only mounts while marketing is allowed; until
 * then the placeholder links to privacy settings and to the video itself.
 */
export function ConsentVideoEmbed({
  provider,
  Icon,
  watchUrl,
  title,
  iframeProps,
}: NonNullable<ReturnType<typeof getVideoEmbed>> & {
  title: string
  iframeProps: React.IframeHTMLAttributes<HTMLIFrameElement>
}) {
  return (
    <ConsentGate
      category="marketing"
      className="not-prose my-6 aspect-video w-full overflow-hidden rounded-xl"
      placeholder={
        <ConsentGate.Root className="flex h-full w-full flex-col items-center justify-center gap-4 rounded-xl border border-border-subtle bg-background-subtle p-6 text-center shadow-none">
          <Icon
            aria-hidden="true"
            weight="fill"
            className="size-10 text-text-muted"
          />
          <div className="max-w-md space-y-1">
            <p className="font-ds-display text-ds-heading-6 font-semibold text-text-primary">
              {title}
            </p>
            <p className="text-ds-body-sm text-text-secondary">
              {provider} can set marketing cookies, so this video plays here
              once you allow marketing in your privacy settings.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <ConsentGate.Button category="marketing">
              Privacy settings
            </ConsentGate.Button>
            {watchUrl ? (
              <Button
                as="a"
                href={watchUrl}
                target="_blank"
                rel="noreferrer"
                variant="link"
              >
                Watch on {provider}
                <ArrowUpRightIcon aria-hidden="true" className="size-4" />
              </Button>
            ) : null}
          </div>
        </ConsentGate.Root>
      }
    >
      <iframe
        title={title}
        {...iframeProps}
        className="h-full w-full border-0"
      />
    </ConsentGate>
  )
}
