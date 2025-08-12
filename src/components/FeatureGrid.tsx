import * as React from 'react'
import { FaCheckCircle } from 'react-icons/fa'

type FeatureGridProps = {
  title?: string
  items: React.ReactNode[]
  gridClassName?: string
}

export function FeatureGrid({ title, items, gridClassName }: FeatureGridProps) {
  return (
    <div className="px-4 sm:px-6 lg:px-8 mx-auto">
      {title ? (
        <div className=" sm:text-center pb-16">
          <h3 className="text-3xl text-center mx-auto leading-tight font-extrabold tracking-tight sm:text-4xl lg:leading-none mt-2">
            {title}
          </h3>
        </div>
      ) : null}
      <div
        className={
          gridClassName ||
          'grid grid-flow-row grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-4 mx-auto'
        }
      >
        {items.map((d, i) => (
          <span key={i} className="flex items-center gap-2">
            <FaCheckCircle className="text-green-500 " /> {d}
          </span>
        ))}
      </div>
    </div>
  )
}
