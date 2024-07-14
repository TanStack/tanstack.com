import { LogoQueryGGSmall } from '~/components/LogoQueryGGSmall'

export function DocsCalloutQueryGG(props: React.HTMLProps<HTMLDivElement>) {
  return (
    <div {...props}>
      <div className="space-y-3">
        <h6 className="text-[.7rem] md:text-[.9em] uppercase font-black">
          Want to Skip the Docs?
        </h6>
        <LogoQueryGGSmall className="w-full" />

        <blockquote className="text-sm -indent-[.45em] pl-2">
          “This course is the best way to learn how to use React Query in
          real-world applications.”
          <cite className="italic block text-right">—Tanner Linsley</cite>
        </blockquote>
        <a
          className="block m-1 px-4 py-2 bg-gradient-to-r from-rose-500 to-violet-500 text-white rounded uppercase font-bold text-sm text-center"
          href="https://query.gg?s=tanstack"
          target="_blank"
        >
          Get the course
        </a>
      </div>
    </div>
  )
}
