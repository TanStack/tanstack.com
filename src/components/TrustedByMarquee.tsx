import { twMerge } from 'tailwind-merge'

const brandLogos: Record<string, string> = {
  Google: '/logos/google.svg',
  Amazon: '/logos/amazon.svg',
  Apple: '/logos/apple.svg',
  Microsoft: '/logos/microsoft.svg',
  Walmart: '/logos/walmart.svg',
  Uber: '/logos/uber.svg',
  Salesforce: '/logos/salesforce.svg',
  Cisco: '/logos/cisco.svg',
  Intuit: '/logos/intuit.svg',
  HP: '/logos/hp.svg',
  Docusign: '/logos/docusign.svg',
  TicketMaster: '/logos/ticketmaster.svg',
  Nordstrom: '/logos/nordstrom.svg',
  'Yahoo!': '/logos/yahoo.svg',
}

type TrustedByMarqueeProps = {
  brands: string[]
  speed?: number // pixels per second
  className?: string
}

export function TrustedByMarquee({
  brands,
  speed = 150,
  className,
}: TrustedByMarqueeProps) {
  const animationDuration = `${(brands.length * 200) / speed}s`

  return (
    <div className={twMerge('overflow-hidden w-full group', className)}>
      <div className="uppercase tracking-wider text-sm font-semibold text-center text-gray-400 mb-6">
        Trusted in Production by
      </div>
      <div className="relative w-full">
        {/* Left fade */}
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#fdfdfd] dark:from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
        {/* Right fade */}
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#fdfdfd] dark:from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
        <div
          className="flex gap-8 items-center whitespace-nowrap will-change-transform animate-[marquee_linear_infinite] group-hover:[animation-play-state:paused]"
          style={{
            animationDuration,
          }}
        >
          {[...brands, ...brands, ...brands].map((brand, i) => {
            const logoSrc = brandLogos[brand]
            return logoSrc ? (
              <img
                key={i}
                src={logoSrc}
                alt={brand}
                loading="lazy"
                className="max-w-24 max-h-14 w-auto h-auto object-contain opacity-50 grayscale hover:opacity-100 transition-all duration-200 dark:invert dark:opacity-70 shrink-0"
              />
            ) : (
              <span
                key={i}
                className="text-lg font-bold opacity-50 dark:opacity-70 shrink-0"
              >
                {brand}
              </span>
            )
          })}
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
