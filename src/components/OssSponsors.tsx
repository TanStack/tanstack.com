import * as React from 'react'
import { ParentSize } from './ParentSize'
import type { OssSponsor } from '~/utils/sponsors.functions'
import { Tooltip } from '~/ui/Tooltip'

const minimumSponsorWeight = 0.05
const maximumSponsorSize = 0.65

type WeightedSponsor = {
  id: string
  sponsor: OssSponsor
  weight: number
}

type SizedSponsor = WeightedSponsor & {
  size: number
}

type SponsorSquare = SizedSponsor & {
  left: number
  top: number
}

type FreeRectangle = {
  height: number
  left: number
  top: number
  width: number
}

function rectanglesIntersect(first: FreeRectangle, second: FreeRectangle) {
  return (
    first.left < second.left + second.width &&
    first.left + first.width > second.left &&
    first.top < second.top + second.height &&
    first.top + first.height > second.top
  )
}

function rectangleContains(outer: FreeRectangle, inner: FreeRectangle) {
  return (
    outer.left <= inner.left &&
    outer.top <= inner.top &&
    outer.left + outer.width >= inner.left + inner.width &&
    outer.top + outer.height >= inner.top + inner.height
  )
}

function pruneFreeRectangles(rectangles: Array<FreeRectangle>) {
  const pruned = rectangles.filter(
    (rectangle) => rectangle.width > 0 && rectangle.height > 0,
  )

  for (let firstIndex = 0; firstIndex < pruned.length; firstIndex++) {
    let removedFirst = false

    for (
      let secondIndex = firstIndex + 1;
      secondIndex < pruned.length;
      secondIndex++
    ) {
      if (rectangleContains(pruned[firstIndex], pruned[secondIndex])) {
        pruned.splice(secondIndex, 1)
        secondIndex--
      } else if (rectangleContains(pruned[secondIndex], pruned[firstIndex])) {
        pruned.splice(firstIndex, 1)
        firstIndex--
        removedFirst = true
        break
      }
    }

    if (removedFirst) continue
  }

  return pruned
}

function splitFreeRectangles(
  rectangles: Array<FreeRectangle>,
  used: FreeRectangle,
) {
  const split: Array<FreeRectangle> = []

  for (const rectangle of rectangles) {
    if (!rectanglesIntersect(rectangle, used)) {
      split.push(rectangle)
      continue
    }

    const rectangleRight = rectangle.left + rectangle.width
    const rectangleBottom = rectangle.top + rectangle.height
    const usedRight = used.left + used.width
    const usedBottom = used.top + used.height

    if (used.left > rectangle.left && used.left < rectangleRight) {
      split.push({
        height: rectangle.height,
        left: rectangle.left,
        top: rectangle.top,
        width: used.left - rectangle.left,
      })
    }

    if (usedRight < rectangleRight && usedRight > rectangle.left) {
      split.push({
        height: rectangle.height,
        left: usedRight,
        top: rectangle.top,
        width: rectangleRight - usedRight,
      })
    }

    if (used.top > rectangle.top && used.top < rectangleBottom) {
      split.push({
        height: used.top - rectangle.top,
        left: rectangle.left,
        top: rectangle.top,
        width: rectangle.width,
      })
    }

    if (usedBottom < rectangleBottom && usedBottom > rectangle.top) {
      split.push({
        height: rectangleBottom - usedBottom,
        left: rectangle.left,
        top: usedBottom,
        width: rectangle.width,
      })
    }
  }

  return pruneFreeRectangles(split)
}

function packSponsorSquares({
  gap,
  height,
  scale,
  sponsors,
  width,
}: {
  gap: number
  height: number
  scale: number
  sponsors: Array<WeightedSponsor>
  width: number
}): Array<SponsorSquare> | undefined {
  let freeRectangles: Array<FreeRectangle> = [
    {
      height: height + gap,
      left: 0,
      top: 0,
      width: width + gap,
    },
  ]
  const squares: Array<SponsorSquare> = []

  for (const sponsor of sponsors) {
    const size = Math.sqrt(sponsor.weight) * scale
    const packedSize = size + gap
    let bestRectangle: FreeRectangle | undefined
    let bestShortSideFit = Infinity
    let bestLongSideFit = Infinity

    for (const rectangle of freeRectangles) {
      if (packedSize > rectangle.width || packedSize > rectangle.height) {
        continue
      }

      const remainingWidth = rectangle.width - packedSize
      const remainingHeight = rectangle.height - packedSize
      const shortSideFit = Math.min(remainingWidth, remainingHeight)
      const longSideFit = Math.max(remainingWidth, remainingHeight)

      const isBetter =
        !bestRectangle ||
        rectangle.top < bestRectangle.top ||
        (rectangle.top === bestRectangle.top &&
          rectangle.left < bestRectangle.left) ||
        (rectangle.top === bestRectangle.top &&
          rectangle.left === bestRectangle.left &&
          shortSideFit < bestShortSideFit) ||
        (rectangle.top === bestRectangle.top &&
          rectangle.left === bestRectangle.left &&
          shortSideFit === bestShortSideFit &&
          longSideFit < bestLongSideFit)

      if (isBetter) {
        bestRectangle = rectangle
        bestShortSideFit = shortSideFit
        bestLongSideFit = longSideFit
      }
    }

    if (!bestRectangle) return

    const usedRectangle: FreeRectangle = {
      height: packedSize,
      left: bestRectangle.left,
      top: bestRectangle.top,
      width: packedSize,
    }

    squares.push({
      ...sponsor,
      left: usedRectangle.left,
      size,
      top: usedRectangle.top,
    })
    freeRectangles = splitFreeRectangles(freeRectangles, usedRectangle)
  }

  return squares
}

function layoutSponsorSquares({
  gap,
  height,
  sponsors,
  width,
}: {
  gap: number
  height: number
  sponsors: Array<WeightedSponsor>
  width: number
}) {
  if (sponsors.length === 0) return []

  let minimumScale = 0
  let maximumScale = Math.min(width, height) / Math.sqrt(sponsors[0].weight)
  let bestLayout: Array<SponsorSquare> = []

  for (let index = 0; index < 16; index++) {
    const scale = (minimumScale + maximumScale) / 2
    const layout = packSponsorSquares({
      gap,
      height,
      scale,
      sponsors,
      width,
    })

    if (layout) {
      minimumScale = scale
      bestLayout = layout
    } else {
      maximumScale = scale
    }
  }

  return bestLayout
}

export default function OssSponsors({
  sponsors,
}: {
  sponsors: Array<OssSponsor>
}) {
  const weightedSponsors = React.useMemo(
    () =>
      sponsors
        .map((sponsor, index) => ({
          id: `${sponsor.login}-${index}`,
          sponsor,
          weight:
            Math.min(sponsor.size, maximumSponsorSize) + minimumSponsorWeight,
        }))
        .sort((a, b) => b.weight - a.weight),
    [sponsors],
  )

  return (
    <ParentSize>
      {({ height, width }) => {
        if (width < 10 || height < 10) return null

        const gap = Math.max(1, Math.round(Math.min(width, height) * 0.004))
        const squares = layoutSponsorSquares({
          gap,
          height,
          sponsors: weightedSponsors,
          width,
        })

        return (
          <div className="relative h-full w-full overflow-hidden rounded-2xl [&:hover_img]:opacity-100 [&:hover_img]:grayscale-0 [&:focus-within_img]:opacity-100 [&:focus-within_img]:grayscale-0">
            {squares.map(({ id, left, size, sponsor, top }) => {
              const name = sponsor.name || sponsor.login

              return (
                <Tooltip key={id} content={name}>
                  <a
                    href={
                      sponsor.linkUrl || `https://github.com/${sponsor.login}`
                    }
                    aria-label={`Visit ${name}`}
                    className="group absolute overflow-hidden bg-transparent focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus"
                    style={{
                      borderRadius: Math.min(10, Math.max(2, size * 0.06)),
                      height: size,
                      left,
                      top,
                      width: size,
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
                      className="h-full w-full object-contain opacity-75 grayscale transition-[filter,opacity] duration-1000 motion-reduce:transition-none"
                    />
                  </a>
                </Tooltip>
              )
            })}
          </div>
        )
      }}
    </ParentSize>
  )
}
