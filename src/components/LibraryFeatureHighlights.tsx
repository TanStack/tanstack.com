import { Library } from '~/libraries'

export function LibraryFeatureHighlights({
  featureHighlights,
}: {
  featureHighlights: Library['featureHighlights']
}) {
  return featureHighlights?.length ? (
    <div
      className={`grid grid-cols-1 text-lg md:grid-cols-2 ${
        featureHighlights.length > 3 ? 'xl:grid-cols-4' : 'xl:grid-cols-3'
      } mx-auto max-w-[1200px] gap-x-8 gap-y-12 p-8`}
    >
      {featureHighlights?.map((featureHighlight) => {
        return (
          <div
            key={featureHighlight.title}
            className="relative flex flex-1 flex-col items-center gap-4 rounded-xl bg-white/50 p-4 pt-6 shadow-xl dark:bg-black/40"
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2/3 rounded-full bg-white p-2 text-center text-3xl shadow-md dark:bg-black/50">
              {featureHighlight.icon}
            </div>
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-black uppercase">
                {featureHighlight.title}
              </h3>
              <p className="text-sm leading-6 text-gray-800 dark:text-gray-200">
                {featureHighlight.description}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  ) : null
}
