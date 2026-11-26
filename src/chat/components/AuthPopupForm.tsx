import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'

export function AuthPopupForm({
  action,
  children,
}: {
  action: string
  children: ReactNode
}) {
  const queryClient = useQueryClient()
  const cleanup = useRef<(() => void) | undefined>(undefined)
  const active = useRef<Window | null>(null)
  const [error, setError] = useState('')
  useEffect(
    () => () => {
      cleanup.current?.()
      active.current?.close()
    },
    [],
  )
  return (
    <>
      <form
        method="post"
        action={action}
        onSubmit={(event) => {
          event.preventDefault()
          if (active.current && !active.current.closed) {
            active.current.focus()
            return
          }
          cleanup.current?.()
          setError('')
          const form = event.currentTarget
          const channelId = crypto.randomUUID()
          const name = `tanstack-auth-${channelId}`
          const channel = new BroadcastChannel(`tanstack.auth.${channelId}`)
          const popup = window.open(
            'about:blank',
            name,
            'popup,width=560,height=760',
          )
          if (!popup) {
            channel.close()
            if (window.gumDesktop) {
              setError(
                'The sign-in window could not open. Update or restart the desktop app and try again.',
              )
            } else {
              form.submit()
            }
            return
          }
          active.current = popup
          const complete = () => {
            cleanup.current?.()
            popup.close()
            active.current = null
            void queryClient.invalidateQueries({ queryKey: ['bootstrap'] })
          }
          channel.onmessage = (message) => {
            if (message.data?.type === 'kody-banks:auth-complete') complete()
          }
          const finish = (message: MessageEvent) => {
            if (
              message.origin !== window.location.origin ||
              message.source !== popup ||
              message.data?.type !== 'kody-banks:auth-complete'
            )
              return
            complete()
          }
          window.addEventListener('message', finish)
          const timer = window.setTimeout(() => {
            cleanup.current?.()
            active.current = null
            setError('Sign-in expired. Try again.')
          }, 600_000)
          cleanup.current = () => {
            window.removeEventListener('message', finish)
            window.clearTimeout(timer)
            channel.close()
            cleanup.current = undefined
          }
          const originalAction = form.action
          const originalTarget = form.target
          const target = new URL(action, window.location.origin)
          target.searchParams.set('popup', '1')
          target.searchParams.set('popupChannel', channelId)
          form.action = target.href
          form.target = name
          form.submit()
          form.action = originalAction
          form.target = originalTarget
        }}
      >
        {children}
      </form>
      {error && <p role="alert">{error}</p>}
    </>
  )
}
