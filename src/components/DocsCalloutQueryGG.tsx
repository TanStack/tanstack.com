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
        <h6 className="text-[.7rem] font-black uppercase opacity-50">
          Want to Skip the Docs?
        </h6>
        <LogoQueryGGSmall className="w-full" />

        <blockquote className="pl-2 -indent-[.45em] text-sm">
          “If you’re serious about *really* understanding React Query, there’s
          no better way than with query.gg”
          <cite className="block text-right italic">—Tanner Linsley</cite>
        </blockquote>

        <div className="z-10 grid justify-center bg-gray-800 text-gray-100 dark:bg-gray-100 dark:text-gray-800"></div>

        {ppp && (
          <>
            <p className="py-2 pl-2 text-sm">
              To help make query.gg more accessible, you can enable a regional
              discount of {ppp.discount * 100}% off for being in {ppp.flag}{' '}
              {ppp.country}.
            </p>
          </>
        )}
        <button className="m-1 mx-auto block w-full cursor-default rounded border-2 px-4 py-2 text-center text-sm font-bold uppercase hover:bg-gray-100/70 dark:border-gray-700/80 dark:hover:bg-gray-800">
          {ppp ? ` Get ${ppp.discount * 100}% off ${ppp.flag}` : 'Learn More'}
        </button>
      </div>
    </a>
  )
}
