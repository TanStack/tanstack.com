import { LogoQueryGGSmall } from '~/components/LogoQueryGGSmall'

export function DocsCalloutQueryGG(props: React.HTMLProps<HTMLDivElement>) {
  return (
    <div {...props}>
      <div className="space-y-3">
        <h6 className="text-[.7rem] md:text-[.9em] uppercase font-black">
          Want to Skip the Docs?
        </h6>
        <LogoQueryGGSmall className="w-full" />
        
        {/* <blockquote className="text-sm -indent-[.45em] pl-2">
          “This course is the best way to learn how to use React Query in
          real-world applications.”
          <cite className="italic block text-right">—Tanner Linsley</cite>
        </blockquote> */}
      </div>
      <div className="grid justify-center bg-gray-800 dark:bg-gray-100 text-gray-100 dark:text-gray-800 z-10">
        <div className="p-2 uppercase text-center place-self-center">
          <h2 className="mt-1 mb-3 px-2 text-sm font-semibold">Launch sale happening now</h2>
          <div className="mb-4 countdown flex gap-1.5 justify-center">
            <div className="days grid grid-cols-2 gap-x-1 gap-y-1.5">
              <span className="h-[1.8em] w-[1.6em] grid place-content-center rounded-sm bg-gray-100 bg-opacity-10 dark:bg-gray-800 dark:bg-opacity-10 text-sm font-semibold">0</span>
              <span className="h-[1.8em] w-[1.6em] grid place-content-center rounded-sm bg-gray-100 dark:bg-gray-800 bg-opacity-10 dark:bg-opacity-10 text-sm font-semibold">3</span>
              <p className="col-span-full text-[.6rem]">days</p>
            </div>
            <span className="h-[1.4em] grid place-content-center">:</span>
            <div className="hours grid grid-cols-2 gap-x-1 gap-y-1.5">
              <span className="h-[1.8em] w-[1.6em] grid place-content-center rounded-sm bg-gray-100 dark:bg-gray-800 bg-opacity-10 dark:bg-opacity-10 text-sm font-semibold">2</span>
              <span className="h-[1.8em] w-[1.6em] grid place-content-center rounded-sm bg-gray-100 dark:bg-gray-800 bg-opacity-10 dark:bg-opacity-10 text-sm font-semibold">1</span>
              <p className="col-span-full text-[.6rem]">hours</p>
            </div>
            <span className="h-[1.4em] grid place-content-center">:</span>
            <div className="minutes grid grid-cols-2 gap-x-1 gap-y-1.5">
              <span className="h-[1.8em] w-[1.6em] grid place-content-center rounded-sm bg-gray-100 dark:bg-gray-800 bg-opacity-10 dark:bg-opacity-10 text-sm font-semibold">1</span>
              <span className="h-[1.8em] w-[1.6em] grid place-content-center rounded-sm bg-gray-100 dark:bg-gray-800 bg-opacity-10 dark:bg-opacity-10 text-sm font-semibold">4</span>
              <p className="col-span-full text-[.6rem]">minutes</p>
            </div>
          </div>
          <a
            className="block m-1 px-4 py-2 bg-gradient-to-r from-rose-500 to-violet-500 text-white rounded uppercase font-bold text-sm text-center"
            href="https://query.gg?s=tanstack"
            target="_blank"
            rel="noreferrer"
          >
            Join now
          </a>
        </div>
      </div>
    </div>
  )
}
