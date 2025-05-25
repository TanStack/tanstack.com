import { LogoQueryGGSmall } from '~/components/LogoQueryGGSmall'
import { useQueryGGPPPDiscount } from '~/hooks/useQueryGGPPPDiscount'

export function DocsCalloutQueryGG() {
  const ppp = useQueryGGPPPDiscount()

  return (
    <a
      target="_blank"
      className="cursor-pointer"
      href="https://query.gg?s=tanstack"
      rel="noreferrer"
    >
      <div className="space-y-3">
        <h6 className="text-[.7rem] uppercase font-black opacity-50">
          Want to Skip the Docs?
        </h6>
        <LogoQueryGGSmall className="w-full" />

        <blockquote className="text-sm -indent-[.45em] pl-2">
          “If you’re serious about *really* understanding React Query, there’s
          no better way than with query.gg”
          <cite className="italic block text-right">—Tanner Linsley</cite>
        </blockquote>

        <div className="grid justify-center bg-gray-800 dark:bg-gray-100 text-gray-100 dark:text-gray-800 z-10"></div>

        {ppp && (
          <>
            <p className="text-sm pl-2 py-2">
              To help make query.gg more accessible, you can enable a regional
              discount of {ppp.discount * 100}% off for being in {ppp.flag}{' '}
              {ppp.country}.
            </p>
          </>
        )}
        <button className="block m-1 w-full mx-auto px-4 py-2 rounded uppercase font-bold text-sm text-center hover:bg-gray-100/70 dark:hover:bg-gray-800 cursor-default border-2 dark:border-gray-700/80">
          {ppp ? ` Get ${ppp.discount * 100}% off ${ppp.flag}` : 'Learn More'}
        </button>
      </div>
    </a>
  )
}
