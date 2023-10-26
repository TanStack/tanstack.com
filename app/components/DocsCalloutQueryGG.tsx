import { LogoQueryGGSmall } from '~/components/LogoQueryGGSmall'

export function DocsCalloutQueryGG(props: React.HTMLProps<HTMLDivElement>) {
  return (
    <div className="space-y-4" {...props}>
      <h6 className="text-[.7rem] md:text-[.9em] uppercase font-black">
        Want to Skip the Docs?
      </h6>
      <LogoQueryGGSmall className="w-full" />
      <blockquote className="text-sm -indent-[.45em] pl-2">
        “This course is the best way to learn how to use React Query in real-world applications.”
        <cite className="italic block text-right">—Tanner Linsley</cite>
      </blockquote>
      <a
        className="block w-full px-4 py-2 bg-gradient-to-r from-rose-500 to-violet-500 text-white rounded uppercase font-bold text-sm text-center"
        href="https://query.gg?from=tanstack"
        target="_blank"
        rel="noreferrer"
      >Check it out</a>
    </div>
  )
}