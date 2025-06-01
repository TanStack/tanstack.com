import { useQueryGGPPPDiscount } from '~/hooks/useQueryGGPPPDiscount'
import cornerFishBottomRight from '~/images/query-corner-fish-bottom-right.svg'
import cornerTopLeft from '~/images/query-corner-top-left.svg'
import cornerTopRight from '~/images/query-corner-top-right.svg'
import headerCourse from '~/images/query-header-course.svg'

export function QueryGGBanner() {
  const ppp = useQueryGGPPPDiscount()

  let body = (
    <>
      <p className="text-lg">
        “If you’re serious about *really* understanding React Query, there’s no
        better way than with query.gg”
      </p>
      <p className="mt-2"> —Tanner Linsley</p>
    </>
  )

  if (ppp) {
    body = (
      <>
        <p className="mb-2 text-lg font-bold">
          We noticed you’re in {ppp.flag} {ppp.country}
        </p>
        <p>
          To help make query.gg more globally accessible, you can enable a
          regional discount of {ppp.discount * 100}% off.
        </p>
      </>
    )
  }

  return (
    <aside className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-8">
      <div className="relative w-full border-4 border-[#231f20] bg-[#f9f4da] xl:flex xl:gap-6">
        <a
          href="https://query.gg?s=tanstack"
          className="grid grid-cols-[70px_1fr_70px] pb-4 sm:grid-cols-[100px_1fr_100px] md:grid-cols-[140px_1fr_140px] xl:w-7/12 xl:grid-cols-[110px_1fr] 2xl:grid-cols-[150px_1fr]"
        >
          <img src={cornerTopLeft} alt="sun" className="" />
          <img
            src={headerCourse}
            alt="Query.gg - The Official React Query Course"
            className="-mt-[1px] w-10/12 max-w-[350px] justify-self-center"
          />
          <img src={cornerTopRight} alt="moon" className="xl:hidden" />
        </a>
        <div className="z-0 mr-[-55px] hidden w-[80px] -skew-x-[15deg] border-4 border-r-0 border-[#f9f4da] border-s-[#f9f4da] bg-[#231f20] shadow-[-4px_0_0_#231f20] xl:block"></div>
        <div className="z-10 grid justify-center border-2 border-[#f9f4da] bg-[#231f20] py-2 text-[#f9f4da] xl:w-5/12 xl:grid-cols-[1fr_90px] xl:border-4 xl:border-l-0 xl:pb-0 2xl:grid-cols-[1fr_120px]">
          <div className="my-2 place-self-center text-center">
            {body}
            <a
              href="https://query.gg?s=tanstack"
              className="mt-4 mb-1 inline-block cursor-pointer rounded-full border border-black bg-[#fcba28] px-6 py-2 font-black text-[#231f20] uppercase xl:mb-2"
            >
              {ppp?.discount ? `Get ${ppp.discount * 100}% off` : 'Join now'}
            </a>
          </div>
          <img
            src={cornerFishBottomRight}
            alt="mutated fish"
            className="hidden self-end xl:block"
          />
        </div>
      </div>
    </aside>
  )
}
