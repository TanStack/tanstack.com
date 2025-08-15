import { TbHeartHandshake } from 'react-icons/tb'

interface PartnershipCalloutProps {
  libraryName: string
}

export function PartnershipCallout({ libraryName }: PartnershipCalloutProps) {
  return (
    <div
      className="flex-1 flex flex-col items-center text-sm text-center
                  bg-white/80 shadow-xl shadow-gray-500/20 rounded-lg
                    divide-y-2 divide-gray-500/10 overflow-hidden
                    dark:bg-black/40 dark:shadow-none w-[500px] max-w-full mx-auto"
    >
      <span className="flex items-center gap-2 p-8 text-3xl text-rose-500 font-black uppercase">
        {libraryName} <TbHeartHandshake /> You?
      </span>
      <div className="flex flex-col p-4 gap-3">
        <div>
          We're looking for TanStack {libraryName} Partners to join our mission!
          Partner with us to push the boundaries of {libraryName} and build
          amazing things together.
        </div>
        <a
          href={`mailto:partners@tanstack.com?subject=TanStack ${libraryName} Partnership`}
          className="text-blue-500 uppercase font-black text-sm"
        >
          Let's chat
        </a>
      </div>
    </div>
  )
}
