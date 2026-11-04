import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { workspaceApi } from './WorkspaceApi'
import { Button } from './ui/Button'
import '../client/desktop-host'
const api = workspaceApi()
type Device = {
  id: string
  name: string
  online: boolean
  folders: { id: string; name: string }[]
}
export function DeviceSettings({ userId }: { userId: string }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const desktop =
    typeof window === 'undefined' ? undefined : window.gumDesktop?.devices
  const devices = useQuery({
    queryKey: ['devices', userId],
    queryFn: async () => (await api.request('account/devices')) as Device[],
    refetchInterval: 10000,
  })
  const local = useQuery({
    queryKey: ['local-device', userId],
    queryFn: () => desktop!.status(),
    enabled: !!desktop,
    refetchInterval: 5000,
  })
  async function act(fn: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await fn()
      await Promise.all([
        devices.refetch(),
        desktop ? local.refetch() : Promise.resolve(),
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Device action failed.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section>
      <h3>Devices</h3>
      {desktop && (
        <div>
          <strong>{local.data?.name || 'This device'}</strong>
          <>
            <Button
              disabled={busy}
              onClick={() => void act(() => desktop.shareFolder())}
            >
              Share a folder
            </Button>
            {local.data?.folders.map((folder) => (
              <div key={folder.id}>
                {folder.name}{' '}
                <Button
                  disabled={busy}
                  onClick={() =>
                    void act(() => desktop.removeFolder(folder.id))
                  }
                >
                  Remove access
                </Button>
              </div>
            ))}
          </>
          {local.data?.error && <p role="status">{local.data.error}</p>}
        </div>
      )}
      {devices.data?.map((device) => (
        <div key={device.id}>
          <strong>{device.name}</strong> ·{' '}
          {device.online ? 'Online' : 'Offline'}{' '}
          <Button
            disabled={busy}
            onClick={() =>
              void act(() =>
                api.request('account/devices', {
                  method: 'POST',
                  body: JSON.stringify({ type: 'revoke', id: device.id }),
                }),
              )
            }
          >
            Revoke access
          </Button>
        </div>
      ))}
      {!desktop && devices.data?.length === 0 && (
        <p>Sign in to the desktop app to share a folder.</p>
      )}
      {(error || devices.error) && (
        <p role="alert">{error || 'Could not load devices.'}</p>
      )}
    </section>
  )
}
