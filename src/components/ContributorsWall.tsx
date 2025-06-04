import { type Library } from '~/libraries'

export function ContributorsWall({ library }: { library: Library }) {
  return (
    <div className="flex flex-col items-center my-4">
      <a
        href={`https://github.com/${library.repo}/graphs/contributors`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <img
          alt="GitHub Contributors"
          src={`https://contrib.rocks/image?repo=tanstack/${library.id}`}
          loading="lazy"
        />
      </a>
    </div>
  )
}
