import * as React from 'react'
import { Treemap, hierarchy, treemapSquarify } from '@visx/hierarchy'
import { ParentSize } from './ParentSize'
import type { OssSponsor } from '~/utils/sponsors.functions'
import { Tooltip } from '~/ui'

const minimumSponsorWeight = 0.01

type SponsorTreeNode = {
  children?: Array<SponsorTreeNode>
  id: string
  sponsor?: OssSponsor
  weight: number
}

type SponsorTreemapTile = NonNullable<
  React.ComponentProps<typeof Treemap<SponsorTreeNode>>['tile']
>

const layoutSponsorsFromTop: SponsorTreemapTile = (node, x0, y0, x1, y1) => {
  treemapSquarify(node, y0, x0, y1, x1)

  node.children?.forEach((child) => {
    const logicalX0 = child.x0
    const logicalX1 = child.x1

    child.x0 = child.y0
    child.x1 = child.y1
    child.y0 = logicalX0
    child.y1 = logicalX1
  })
}

export default function OssSponsors({
  sponsors,
}: {
  sponsors: Array<OssSponsor>
}) {
  const root = React.useMemo(() => {
    const tree: SponsorTreeNode = {
      children: sponsors.map((sponsor, index) => ({
        id: `${sponsor.login}-${index}`,
        sponsor,
        weight: sponsor.size + minimumSponsorWeight,
      })),
      id: 'oss-sponsors',
      weight: 0,
    }

    return hierarchy(tree)
      .sum((node) => node.weight)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  }, [sponsors])

  return (
    <ParentSize>
      {({ height, width }) =>
        width < 10 || height < 10 ? null : (
          <div className="relative h-full w-full overflow-hidden rounded-2xl bg-gray-200 dark:bg-gray-800">
            <Treemap
              root={root}
              size={[width, height]}
              tile={layoutSponsorsFromTop}
              round
              paddingInner={Math.max(
                1,
                Math.round(Math.min(width, height) * 0.004),
              )}
              paddingOuter={0}
            >
              {(treemap) =>
                treemap.leaves().map((node) => {
                  const sponsor = node.data.sponsor
                  if (!sponsor) return null

                  const tileWidth = node.x1 - node.x0
                  const tileHeight = node.y1 - node.y0
                  const shortestSide = Math.min(tileWidth, tileHeight)
                  const name = sponsor.name || sponsor.login

                  return (
                    <Tooltip key={node.data.id} content={name}>
                      <a
                        href={
                          sponsor.linkUrl ||
                          `https://github.com/${sponsor.login}`
                        }
                        aria-label={`Visit ${name}`}
                        className="group absolute overflow-hidden bg-gray-100 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus dark:bg-gray-950"
                        style={{
                          borderRadius: Math.min(
                            10,
                            Math.max(2, shortestSide * 0.06),
                          ),
                          height: tileHeight,
                          left: node.x0,
                          top: node.y0,
                          width: tileWidth,
                        }}
                      >
                        <img
                          src={
                            sponsor.imageUrl ||
                            `https://avatars.githubusercontent.com/${sponsor.login}`
                          }
                          alt=""
                          loading="lazy"
                          decoding="async"
                          draggable={false}
                          className="h-full w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.03] group-focus-visible:scale-[1.03] motion-reduce:transition-none"
                        />
                        <span className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/10 group-focus-visible:bg-black/10 motion-reduce:transition-none" />
                      </a>
                    </Tooltip>
                  )
                })
              }
            </Treemap>
          </div>
        )
      }
    </ParentSize>
  )
}
