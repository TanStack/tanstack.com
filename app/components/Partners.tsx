import { twMerge } from 'tailwind-merge'
import { partners } from '~/utils/partners'

type PartnersProps = {
  libraryId: string
  repo: string
}

export function Partners({ libraryId, repo }: PartnersProps) {
  return (
    <div className="bg-white dark:bg-gray-900/30 border-gray-500/20 shadow-xl divide-y divide-gray-500/20 flex flex-col border border-r-0 border-t-0 rounded-bl-lg">
      <div className="uppercase font-black text-center p-3 opacity-50">
        Our Partners
      </div>

      {!partners.some((d) => d.libraries?.includes(libraryId as any)) ? (
        <div className="hover:bg-gray-500/10 dark:hover:bg-gray-500/10 transition-colors">
          <a
            href={`mailto:partners@tanstack.com?subject=TanStack ${
              repo.split('/')[1]
            } Partnership`}
            className="p-2 block text-xs"
          >
            <span className="opacity-50 italic">
              Wow, it looks like you could be our first partner for this
              library!
            </span>{' '}
            <span className="text-blue-500 font-black">Chat with us!</span>
          </a>
        </div>
      ) : (
        partners
          .filter((d) => d.sidebarImgLight)
          .filter((d) => d.libraries?.includes(libraryId as any))
          .map((partner) => {
            return (
              <div
                key={partner.name}
                className="overflow-hidden hover:bg-gray-500/10 dark:hover:bg-gray-500/10 transition-colors"
              >
                <a
                  href={partner.href}
                  target="_blank"
                  className="px-4 flex items-center justify-center cursor-pointer"
                  rel="noreferrer"
                >
                  <div className="mx-auto max-w-[150px]">
                    <img
                      src={partner.sidebarImgLight}
                      alt={partner.name}
                      className={twMerge(
                        'w-full',
                        partner.sidebarImgClass,
                        'dark:hidden'
                      )}
                    />
                    <img
                      src={partner.sidebarImgDark || partner.sidebarImgLight}
                      alt={partner.name}
                      className={twMerge(
                        'w-full',
                        partner.sidebarImgClass,
                        'hidden dark:block'
                      )}
                    />
                  </div>
                </a>
              </div>
            )
          })
      )}
    </div>
  )
}
