import { LogoQueryGGSmall } from '~/components/LogoQueryGGSmall';
import CountdownTimerSmall from '~/components/CountdownTimerSmall';

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
          <h2 className="mt-1 mb-1 px-2 text-md font-semibold">
            Launch week sale
          </h2>
          <p className="normal-case mb-4 text-sm text-balance">Up to 30% off through June 6th</p>
          <CountdownTimerSmall targetDate="2024-06-07" />
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
