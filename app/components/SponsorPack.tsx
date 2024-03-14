import React from 'react'
import { Pack, hierarchy } from '@visx/hierarchy'
import { ParentSize } from '@visx/responsive'
import { twMerge } from 'tailwind-merge'
import { set } from 'date-fns'

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

  // const [show, setShow] = React.useState(false)

  // React.useEffect(() => {
  //   setShow(true)
  // }, [])

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
                will-change: transform;
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
                            `absolute shadow-lg bg-white rounded-full z-0`
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
                            className={`absolute bg-no-repeat bg-center bg-contain rounded-full
                                    w-[95%] h-[95%] dark:w-[100.5%] dark:h-[100.5%]
                                    left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                                    `}
                            style={{
                              backgroundImage: `url(${
                                circle.data.imageUrl ||
                                `https://avatars0.githubusercontent.com/${
                                  circle.data.login
                                }?v=3&s=${Math.round(circle.r * 2)}`
                              })`,
                            }}
                          />
                          <div
                            className={twMerge(
                              `spon-tooltip absolute text-sm
                              bg-gray-800 text-white p-2 pointer-events-none
                              transform opacity-0
                              shadow-xl rounded-lg
                              flex flex-col items-center
                            `,

                              tooltipX == 'left'
                                ? `left-1/4 -translate-x-full`
                                : `right-1/4 translate-x-full`,
                              tooltipY == 'top'
                                ? `top-1/4 -translate-y-full`
                                : `bottom-1/4 translate-y-full`
                            )}
                          >
                            <p className={`whitespace-nowrap font-bold`}>
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
