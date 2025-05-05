import headerCourse from '~/images/query-header-course.svg'
import cornerTopLeft from '~/images/query-corner-top-left.svg'
import cornerTopRight from '~/images/query-corner-top-right.svg'
import cornerFishBottomRight from '~/images/query-corner-fish-bottom-right.svg'
import CountdownTimer from '~/components/CountdownTimer'

export function QueryGGBannerSale(props: React.HTMLProps<HTMLDivElement>) {
  return (
    <aside
      {...props}
      className="mx-auto w-full max-w-[1200px] p-8 -mt-32 flex justify-between items-center"
    >
      <div className="w-full xl:flex xl:gap-6 bg-[#f9f4da] border-4 border-[#231f20]">
        <a
          href="https://query.gg?s=tanstack"
          className="xl:w-[50%] pb-4 grid grid-cols-[70px_1fr_70px] sm:grid-cols-[100px_1fr_100px] md:grid-cols-[140px_1fr_140px] xl:grid-cols-[110px_1fr] 2xl:grid-cols-[150px_1fr]"
        >
          <img src={cornerTopLeft} alt="sun" className="" />
          <img
            src={headerCourse}
            alt="Query.gg - The Official React Query Course"
            className="-mt-[1px] w-10/12 max-w-[400px] justify-self-center"
          />
          <img src={cornerTopRight} alt="moon" className="xl:hidden" />
        </a>
        <div className="hidden xl:block w-[80px] mr-[-60px] bg-[#231f20] border-4 border-r-0 border-[#f9f4da] border-s-[#f9f4da] shadow-[-4px_0_0_#231f20] -skew-x-[15deg] z-0"></div>
        <div className="xl:w-[50%] py-2 xl:pb-0 grid xl:grid-cols-[1fr_90px] 2xl:grid-cols-[1fr_120px] justify-center bg-[#231f20] border-2 xl:border-4 xl:border-l-0 border-[#f9f4da] text-[#f9f4da] z-10">
          <div className="my-2 uppercase text-center place-self-center">
            {/* <h2 className="mt-1 mb-3 px-2 text-sm font-semibold">Launch sale happening now</h2> */}
            <h2 className="mb-1 text-lg lg:text-2xl xl:text-3xl font-semibold">
              Launch week sale
            </h2>
            <p className="normal-case mb-4">Up to 30% off through May 17th</p>
            <CountdownTimer targetDate="2025-05-17" />
            <a
              href="https://query.gg?s=tanstack"
              className="mt-4 mb-1 xl:mb-2 px-6 py-2 inline-block bg-[#fcba28] text-[#231f20] rounded-full uppercase border border-black cursor-pointer font-black"
            >
              Join now
            </a>
          </div>
          <img
            src={cornerFishBottomRight}
            alt="mutated fish"
            className="hidden xl:block self-end"
          />
        </div>
      </div>
    </aside>
  )
}
