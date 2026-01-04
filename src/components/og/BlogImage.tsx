import { Post } from 'content-collections'
import { formatAuthors } from '~/utils/blog'

export function BlogImage({
  title,
  description,
  headerImage,
  authors,
  published,
}: Post) {
  return (
    <div
      tw="w-full h-full bg-cover bg-center bg-no-repeat bg-[#171717]"
      style={{
        backgroundImage: headerImage
          ? `url(https://tanstack.com${headerImage})`
          : 'none',
      }}
    >
      <div tw="w-full h-full flex-col p-16 text-pretty backdrop-blur-md backdrop-brightness-30">
        <img
          src="https://tanstack.com/images/logos/splash-dark.png"
          tw="w-24"
        />
        <div tw="grow" />
        <p tw="text-white text-6xl mb-4 font-bold line-clamp-2 text-ellipsis">
          {title}
        </p>
        <p tw="text-white/85 text-4xl font-medium line-clamp-2 text-ellipsis mb-6">
          {description}
        </p>
        <div tw="flex items-center gap-2">
          <p tw="text-white/85 text-2xl font-medium uppercase tracking-wider font-mono">
            by {formatAuthors(authors)} on {published}
          </p>
        </div>
      </div>
    </div>
  )
}
