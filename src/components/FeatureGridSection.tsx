import type { ReactNode } from 'react'
import { FeatureGrid } from '~/components/FeatureGrid'

interface FeatureGridSectionProps {
  title: string
  description?: ReactNode
  items: ReactNode[]
  gridClassName?: string
}

export function FeatureGridSection({
  title,
  description,
  items,
  gridClassName,
}: FeatureGridSectionProps) {
  return (
    <div className="px-4 sm:px-6 lg:px-8 mx-auto">
      <div className="pb-8">
        <h3 className="text-3xl font-bold">{title}</h3>
        {description && (
          <p className="mt-4 text-xl max-w-3xl leading-7 opacity-60">
            {description}
          </p>
        )}
      </div>
      <FeatureGrid items={items} gridClassName={gridClassName} />
    </div>
  )
}
