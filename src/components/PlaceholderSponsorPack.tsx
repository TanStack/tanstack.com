import React from 'react'
import { Pack, hierarchy } from '@visx/hierarchy'
import { ParentSize } from '@visx/responsive'

// Generate realistic placeholder sponsor data with curved distribution
// Simulates real sponsor ecosystems: few large sponsors, many small ones
const generatePlaceholderSponsors = () => {
  const sponsors = []
  const totalSponsors = 150 // More realistic number

  for (let i = 0; i < totalSponsors; i++) {
    const normalizedIndex = i / (totalSponsors - 1)
    const size = Math.pow(1 - normalizedIndex, 10)

    const jitter = (Math.random() - 0.5) * 0.1
    const finalSize = Math.max(0.01, Math.min(1.0, size + jitter))

    sponsors.push({
      login: `placeholder-${i + 1}`,
      name: '',
      imageUrl: '',
      linkUrl: '',
      size: finalSize,
    })
  }

  // Sort by size descending (largest first) like real sponsor data
  return sponsors.sort((a, b) => b.size - a.size)
}

export default function PlaceholderSponsorPack() {
  const sponsors = React.useMemo(() => generatePlaceholderSponsors(), [])

  const pack = React.useMemo(
    () => ({
      children: sponsors,
      name: 'root',
      radius: 0,
      distance: 0,
    }),
    [sponsors]
  )

  const root = React.useMemo(
    () =>
      hierarchy(pack)
        .sum((d: any) => 0.0007 + (d.size || 0))
        .sort(
          (a, b) => ((b.data as any)?.size ?? 0) - ((a.data as any)?.size ?? 0)
        ),
    [pack]
  )

  return (
    <ParentSize>
      {({ width = 800 }) => {
        return width < 10 ? null : (
          <div
            style={{
              width,
              height: width,
              position: 'relative',
            }}
          >
            <style
              dangerouslySetInnerHTML={{
                __html: `
                @keyframes shimmer {
                  0% {
                    background-position: -200% 0;
                  }
                  100% {
                    background-position: 200% 0;
                  }
                }
                
                .placeholder-bubble {
                  background: linear-gradient(
                    90deg,
                    rgba(156, 163, 175, 0.3) 25%,
                    rgba(156, 163, 175, 0.5) 50%,
                    rgba(156, 163, 175, 0.3) 75%
                  );
                  background-size: 200% 100%;
                  animation: shimmer 2s infinite;
                  transition: all .2s ease;
                  transform: translate(-50%, -50%);
                  will-change: transform;
                }
                
                .placeholder-bubble:hover {
                  transform: translate(-50%, -50%) scale(1.05);
                }
              `,
              }}
            />
            <Pack root={root} size={[width, width]} padding={width * 0.005}>
              {(packData) => {
                const circles = packData.descendants().slice(1) // skip first layer
                return (
                  <div>
                    {[...circles].reverse().map((circle, i) => {
                      return (
                        <div
                          key={`placeholder-circle-${i}`}
                          className="placeholder-bubble absolute rounded-full border border-gray-300/20 dark:border-gray-600/20"
                          style={{
                            left: circle.x,
                            top: circle.y,
                            width: circle.r * 2,
                            height: circle.r * 2,
                          }}
                        />
                      )
                    })}
                  </div>
                )
              }}
            </Pack>
          </div>
        )
      }}
    </ParentSize>
  )
}
