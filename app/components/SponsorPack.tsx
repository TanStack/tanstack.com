import React from 'react'
import { Pack, hierarchy } from '@visx/hierarchy'
import { ParentSize } from '@visx/responsive'
import { tw } from 'twind'

export default function SponsorPack({ sponsors }: { sponsors: any }) {
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
        .sum((d) => 1 + d?.tier?.monthlyPriceInDollars)
        .sort(
          (a, b) =>
            (b.data.tier?.monthlyPriceInDollars ?? 0) -
            (a.data.tier?.monthlyPriceInDollars ?? 0)
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
            <Pack root={root} size={[width, width]} padding={width * 0.005}>
              {(packData) => {
                const circles = packData.descendants().slice(1) // skip first layer
                return (
                  <div>
                    {[...circles].reverse().map((circle, i) => {
                      const tooltipX = circle.x > width / 2 ? 'left' : 'right'
                      const tooltipY = circle.y > width / 2 ? 'top' : 'bottom'

                      return (
                        <a
                          key={`circle-${i}`}
                          href={
                            circle.data.linkUrl ||
                            `https://github.com/${circle.data.login}`
                          }
                          className={
                            `spon-link ` +
                            tw`absolute shadow-lg bg-white rounded-full z-0`
                          }
                          style={{
                            left: circle.x,
                            top: circle.y,
                            width: circle.r * 2,
                            height: circle.r * 2,
                          }}
                        >
                          <div
                            key={`circle-${i}`}
                            className={tw`absolute bg-no-repeat bg-center bg-contain rounded-full`}
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
                          <div
                            className={
                              `spon-tooltip ` +
                              tw(
                                `absolute
                              text-sm
                              bg-gray-900 text-white p-2 pointer-events-none
                              transform opacity-0
                              shadow-xl rounded-lg
                              flex flex-col items-center
                            `,
                                tooltipX == 'left'
                                  ? tw`left-1/4 -translate-x-full`
                                  : tw`right-1/4 translate-x-full`,
                                tooltipY == 'top'
                                  ? tw`top-1/4 -translate-y-full`
                                  : tw`bottom-1/4 translate-y-full`
                              )
                            }
                          >
                            <p className={tw`whitespace-nowrap font-bold`}>
                              {circle.data.name || circle.data.login}
                            </p>
                          </div>
                        </a>
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
