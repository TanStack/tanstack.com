import { HandHeartIcon as HeartHandshake } from '@phosphor-icons/react'
import { Card } from './Card'
import {
  PARTNER_INQUIRY_HREF,
  trackPartnerInquiry,
} from '~/utils/partner-inquiry'

export function PartnershipCallout() {
  return (
    <Card
      className="relative flex-1 flex flex-col items-center text-sm text-center
                    divide-y-2 divide-gray-500/10 overflow-hidden
                    w-[500px] max-w-full mx-auto"
    >
      <span className="flex items-center gap-2 p-8 text-3xl text-rose-500 font-black uppercase">
        TanStack <HeartHandshake /> You?
      </span>
      <div className="flex flex-col p-4 gap-3 text-sm">
        <div>
          We're looking for TanStack partners to support our open-source mission
          and build useful integrations for the ecosystem.
        </div>
        <a
          href={PARTNER_INQUIRY_HREF}
          className="text-blue-500 uppercase font-black text-sm"
          onClick={() => trackPartnerInquiry('library_callout')}
        >
          Let's chat
        </a>
      </div>
    </Card>
  )
}
