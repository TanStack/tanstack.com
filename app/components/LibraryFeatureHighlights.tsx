import { Library } from '~/libraries'

export function LibraryFeatureHighlights({
  featureHighlights,
}: {
  featureHighlights: Library['featureHighlights']
}) {
  return featureHighlights?.length ? (
    <div
      className={`text-lg grid grid-cols-1 md:grid-cols-2 ${
        featureHighlights.length > 3 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
      } gap-12 p-8 max-w-[1200px] mx-auto`}
    >
      {featureHighlights?.map((featureHighlight) => {
        return (
          <div className="flex-1 flex flex-col gap-8 items-center">
            <div className="text-center">{featureHighlight.icon}</div>
            <div className="flex flex-col gap-4">
              <h3 className="uppercase text-xl font-black">
                {featureHighlight.title}
              </h3>
              <p className="text-sm text-gray-800 dark:text-gray-200 leading-6">
                {featureHighlight.description}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  ) : null
}
