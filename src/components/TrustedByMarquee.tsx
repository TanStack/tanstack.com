import * as React from 'react'
import { twMerge } from 'tailwind-merge'

type TrustedByMarqueeProps = {
  brands: string[]
  speed?: number // pixels per second
  className?: string
}

export function TrustedByMarquee({
  brands,
  speed = 40,
  className,
}: TrustedByMarqueeProps) {
  const animationDuration = `${(brands.length * 150) / speed}s`

  return (
    <div className={twMerge('overflow-hidden w-full', className)}>
      <div className="uppercase tracking-wider text-sm font-semibold text-center text-gray-400 mb-3">
        Trusted in Production by
      </div>
      <div className="relative w-full">
        <div
          className="flex gap-6 items-center text-3xl font-bold whitespace-nowrap will-change-transform animate-[marquee_linear_infinite]"
          style={{
            animationDuration,
          }}
        >
          {[...brands, ...brands, ...brands].map((d, i) => (
            <span key={i} className="opacity-70 even:opacity-40">
              {d}
            </span>
          ))}
        </div>
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-33.333%); } }
          .animate-\[marquee_linear_infinite\] { animation-name: marquee; animation-timing-function: linear; animation-iteration-count: infinite; }
        `,
        }}
      />
    </div>
  )
}
