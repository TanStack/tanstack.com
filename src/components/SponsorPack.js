import React from 'react'
import 'twin.macro'
import { Pack, hierarchy } from '@visx/hierarchy'
import { ParentSize } from '@visx/responsive'

export default function SponsorPack({ sponsors, height }) {
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
        .sum((d) => 100 + d.tier.monthlyPriceInDollars)
        .sort(
          (a, b) =>
            b.data.tier.monthlyPriceInDollars -
            a.data.tier.monthlyPriceInDollars
        ),
    [pack]
  )

  return (
    <ParentSize>
      {({ width }) => {
        return width < 10 ? null : (
          <div
            style={{
              width,
              height,
              position: 'relative',
            }}
          >
            <style
              dangerouslySetInnerHTML={{
                __html: `

              .spon-link {
                transition: all .2s ease;
                transform: translate(-50%, -50%);
              }

              .spon-link:hover {
                z-index: 10;
                transform: translate(-50%, -50%) scale(1.1);
              }

              .spon-link:hover .spon-tooltip {
                opacity: 1;
              }
            `,
              }}
            />
            <Pack root={root} size={[width, height]} padding={width * 0.005}>
              {(packData) => {
                const circles = packData.descendants().slice(1) // skip first layer
                return (
                  <div>
                    {[...circles].reverse().map((circle, i) => (
                      <a
                        key={`circle-${i}`}
                        href={
                          circle.data.linkUrl ||
                          `https://github.com/${circle.data.login}`
                        }
                        className="spon-link"
                        tw="absolute shadow-lg bg-white rounded-full z-0"
                        style={{
                          left: circle.x,
                          top: circle.y,
                          width: circle.r * 2,
                          height: circle.r * 2,
                        }}
                      >
                        <div
                          key={`circle-${i}`}
                          tw="absolute bg-no-repeat bg-center bg-contain rounded-full"
                          style={{
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '90%',
                            height: '90%',
                            backgroundImage: `url(${
                              circle.data.imageUrl ||
                              `https://avatars0.githubusercontent.com/${circle.data.login}?v=3&s=200`
                            })`,
                          }}
                        />
                        {circle.data.name ? (
                          <div
                            className="spon-tooltip"
                            tw="absolute -top-0 left-1/2
                          text-sm
                          bg-gray-900 text-white p-2 pointer-events-none
                          transform -translate-x-1/2 -translate-y-full opacity-0
                          shadow-xl rounded-lg"
                          >
                            <span tw="whitespace-nowrap">
                              {circle.data.name}
                            </span>
                          </div>
                        ) : null}
                      </a>
                    ))}
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
