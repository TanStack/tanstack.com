import { Library } from '~/libraries'
import { Card } from './Card'

export function LibraryFeatureHighlights({
  featureHighlights,
}: {
  featureHighlights: Library['featureHighlights']
}) {
  return featureHighlights?.length ? (
    <div
      className={`text-lg grid grid-cols-1 md:grid-cols-2 ${
        featureHighlights.length > 3 ? 'xl:grid-cols-4' : 'xl:grid-cols-3'
      } gap-x-8 gap-y-12 p-8 max-w-[1200px] mx-auto`}
    >
      {featureHighlights?.map((featureHighlight) => {
        return (
          <Card
            key={featureHighlight.title}
            className="p-4 pt-6 flex-1 flex flex-col gap-4 items-center rounded-xl relative"
          >
            <Card className="text-3xl text-center p-2 rounded-full absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2/3">
              {featureHighlight.icon}
            </Card>
            <div className="flex flex-col gap-4">
              <h3 className="uppercase text-xl font-black">
                {featureHighlight.title}
              </h3>
              <div className="text-sm text-gray-800 dark:text-gray-200 leading-6">
                {featureHighlight.description}
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  ) : null
}
