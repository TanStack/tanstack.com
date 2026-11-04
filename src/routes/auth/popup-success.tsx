import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import {
  oauthPopupChannelName,
  oauthPopupChannelSchema,
} from '~/auth/oauth-popup'

export const Route = createFileRoute('/auth/popup-success')({
  component: PopupSuccessPage,
})

function PopupSuccessPage() {
  React.useEffect(() => {
    const parsed = oauthPopupChannelSchema.safeParse(
      new URLSearchParams(window.location.search).get('channel'),
    )
    const message = parsed.success
      ? { type: 'TANSTACK_AUTH_SUCCESS', channel: parsed.data }
      : { type: 'TANSTACK_AUTH_SUCCESS' }
    if (parsed.success && typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(oauthPopupChannelName(parsed.data))
      channel.postMessage(message)
      channel.close()
    }
    if (window.opener)
      window.opener.postMessage(message, window.location.origin)
    if (parsed.success || window.opener) window.close()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center p-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-green-600 dark:text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Signed in successfully
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          You can close this window.
        </p>
      </div>
    </div>
  )
}
