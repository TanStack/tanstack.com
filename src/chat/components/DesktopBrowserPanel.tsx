import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import {
  ArrowLeft,
  ArrowRight,
  MoreHorizontal,
  RotateCw,
  Search,
  X,
} from 'lucide-react'
import {
  useDesktopBrowserHost,
  type DesktopBrowserState,
  type DesktopHistoryEntry,
} from '../client/desktop-host'
import { IconButton } from './IconButton'
import './desktop-browser-panel.css'
import { DesktopUpdateControls } from './DesktopUpdateControls'

type Screen = 'page' | 'history' | 'downloads' | 'extensions' | 'settings'

export function DesktopBrowserPanel({
  active,
  profileId,
}: {
  active: boolean
  profileId: string
}) {
  const { host, updates, issue } = useDesktopBrowserHost()
  const viewport = useRef<HTMLDivElement>(null)
  const addressField = useRef<HTMLInputElement>(null)
  const findField = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<DesktopBrowserState>()
  const [address, setAddress] = useState('')
  const [editing, setEditing] = useState(false)
  const [findText, setFindText] = useState('')
  const [findOpen, setFindOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [zoomOpen, setZoomOpen] = useState(false)
  const [screen, setScreen] = useState<Screen>('page')
  const [history, setHistory] = useState<DesktopHistoryEntry[]>([])
  const [error, setError] = useState('')
  const [profileReady, setProfileReady] = useState(false)
  const run = (action: Promise<unknown>) => {
    setError('')
    void action.catch((cause) => setError(String(cause)))
  }

  useEffect(() => {
    if (!host) return
    let live = true
    setProfileReady(false)
    void host
      .setProfile(profileId)
      .then(() => {
        if (live) setProfileReady(true)
      })
      .catch((cause) => {
        if (live) setError(String(cause))
      })
    return () => {
      live = false
    }
  }, [host, profileId])

  useEffect(() => {
    if (!host || !profileReady) return
    const update = (next: DesktopBrowserState) => {
      setState(next)
      if (!editing) setAddress(next.url)
    }
    const unsubscribe = host.onState(update)
    void host
      .state()
      .then(update)
      .catch((cause) => setError(String(cause)))
    return unsubscribe
  }, [host, editing, profileReady])

  useLayoutEffect(() => {
    if (
      !host ||
      !profileReady ||
      !active ||
      screen !== 'page' ||
      !viewport.current
    ) {
      if (host) void host.hide()
      return
    }
    const element = viewport.current
    const update = () => {
      const rect = element.getBoundingClientRect()
      run(
        host.setBounds({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        }),
      )
    }
    const observer = new ResizeObserver(update)
    observer.observe(element)
    window.addEventListener('resize', update)
    update()
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
      void host.hide()
    }
  }, [
    host,
    profileReady,
    active,
    screen,
    menuOpen,
    zoomOpen,
    findOpen,
    state?.appZoomPercent,
  ])

  const navigate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!host || !address.trim()) return
    setEditing(false)
    setScreen('page')
    run(host.navigate(address.trim()))
  }
  const show = (next: Screen) => {
    setMenuOpen(false)
    setScreen(next)
    if (next === 'history' && host) run(host.history().then(setHistory))
  }
  const closeFind = () => {
    setFindOpen(false)
    setFindText('')
    if (host) run(host.find(''))
  }
  useEffect(() => {
    if (!active || !host || !profileReady) return
    const openFind = () => {
      setScreen('page')
      setFindOpen(true)
      requestAnimationFrame(() => findField.current?.focus())
    }
    const focusAddress = () => {
      addressField.current?.focus()
      addressField.current?.select()
    }
    const unsubscribe = host.onShortcut((shortcut) => {
      if (shortcut === 'find') openFind()
      else focusAddress()
    })
    const shortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return
      const key = event.key.toLowerCase()
      if (key === 'f') {
        event.preventDefault()
        openFind()
      } else if (key === 'l') {
        event.preventDefault()
        focusAddress()
      } else if (key === 'p') {
        event.preventDefault()
        run(host.print())
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => {
      unsubscribe()
      window.removeEventListener('keydown', shortcut)
    }
  }, [active, host, profileReady])

  if (!host)
    return (
      <div>
        <p role="status">
          {issue || 'Browser is available in the desktop app.'}
        </p>
        {updates && <DesktopUpdateControls host={updates} />}
      </div>
    )
  if (!profileReady) return <p role="status">Opening browser…</p>
  return (
    <div className="desktop-browser-panel">
      <form className="desktop-browser-toolbar" onSubmit={navigate}>
        <IconButton
          label="Back"
          disabled={!state?.canGoBack}
          onClick={() => run(host.back())}
        >
          <ArrowLeft size={16} aria-hidden />
        </IconButton>
        <IconButton
          label="Forward"
          disabled={!state?.canGoForward}
          onClick={() => run(host.forward())}
        >
          <ArrowRight size={16} aria-hidden />
        </IconButton>
        <IconButton
          label="Reload page"
          disabled={!state?.url}
          onClick={() => run(host.reload())}
        >
          <RotateCw size={16} aria-hidden />
        </IconButton>
        <input
          ref={addressField}
          aria-label="Website address"
          value={address}
          placeholder="Enter a website address"
          onChange={(event) => setAddress(event.target.value)}
          onFocus={() => setEditing(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setAddress(state?.url ?? '')
              setEditing(false)
              event.currentTarget.blur()
            }
          }}
          onBlur={() => {
            setEditing(false)
            setAddress(state?.url ?? '')
          }}
        />
        <button
          type="button"
          className="desktop-browser-zoom-trigger"
          aria-label={`Browser zoom: ${state?.zoomPercent ?? 100}%`}
          aria-expanded={zoomOpen}
          onClick={() => {
            setMenuOpen(false)
            setZoomOpen(!zoomOpen)
          }}
        >
          {state?.zoomPercent ?? 100}%
        </button>
        <IconButton
          label="Browser menu"
          aria-expanded={menuOpen}
          onClick={() => {
            setZoomOpen(false)
            setMenuOpen(!menuOpen)
          }}
        >
          <MoreHorizontal size={17} aria-hidden />
        </IconButton>
      </form>
      {zoomOpen && (
        <div className="desktop-browser-zoom" aria-label="Browser page zoom">
          <span>Browser page</span>
          <button
            type="button"
            aria-label="Zoom browser page out"
            onClick={() => run(host.zoom(-1))}
          >
            −
          </button>
          <span>{state?.zoomPercent ?? 100}%</span>
          <button
            type="button"
            aria-label="Zoom browser page in"
            onClick={() => run(host.zoom(1))}
          >
            +
          </button>
          <button
            type="button"
            aria-label="Reset browser page zoom"
            onClick={() => run(host.zoom(0))}
          >
            ↺
          </button>
        </div>
      )}
      {menuOpen && (
        <div className="desktop-browser-menu" aria-label="Browser menu">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false)
              setScreen('page')
              setFindOpen(true)
              requestAnimationFrame(() => findField.current?.focus())
            }}
          >
            Find in page
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false)
              run(host.print())
            }}
          >
            Print
          </button>
          <button
            type="button"
            onClick={() =>
              run(
                host.setDeviceEmulation(
                  state?.deviceEmulation === 'off' ? 'phone' : 'off',
                ),
              )
            }
          >
            {state?.deviceEmulation && state.deviceEmulation !== 'off'
              ? 'Hide'
              : 'Show'}{' '}
            device toolbar
          </button>
          <button
            type="button"
            disabled={!state?.url}
            onClick={() => {
              setMenuOpen(false)
              run(host.screenshot())
            }}
          >
            Take a screenshot
          </button>
          <button type="button" onClick={() => show('downloads')}>
            Downloads
          </button>
          <button type="button" onClick={() => show('history')}>
            History
          </button>
          <button type="button" onClick={() => show('extensions')}>
            Extensions ({state?.extensions.length ?? 0})
          </button>
          <button type="button" onClick={() => show('settings')}>
            Browser settings
          </button>
        </div>
      )}
      {findOpen && screen === 'page' && (
        <form
          className="desktop-browser-find"
          onSubmit={(event) => {
            event.preventDefault()
            run(host.find(findText, true))
          }}
        >
          <Search size={15} aria-hidden />
          <input
            ref={findField}
            aria-label="Find in page"
            value={findText}
            onChange={(event) => {
              setFindText(event.target.value)
              run(host.find(event.target.value))
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeFind()
            }}
          />
          <span aria-live="polite">
            {findText
              ? `${state?.find.active ?? 0}/${state?.find.matches ?? 0}`
              : ''}
          </span>
          <IconButton
            label="Previous match"
            disabled={!findText}
            onClick={() => run(host.find(findText, true, false))}
          >
            <ArrowLeft size={15} aria-hidden />
          </IconButton>
          <IconButton
            label="Next match"
            disabled={!findText}
            onClick={() => run(host.find(findText, true, true))}
          >
            <ArrowRight size={15} aria-hidden />
          </IconButton>
          <IconButton label="Close find" onClick={closeFind}>
            <X size={15} aria-hidden />
          </IconButton>
        </form>
      )}
      {state && state.deviceEmulation !== 'off' && screen === 'page' && (
        <div className="desktop-browser-device">
          <label htmlFor="desktop-browser-device">Device</label>
          <select
            id="desktop-browser-device"
            value={state?.deviceEmulation ?? 'off'}
            onChange={(event) =>
              run(
                host.setDeviceEmulation(
                  event.target.value as 'off' | 'phone' | 'tablet',
                ),
              )
            }
          >
            <option value="phone">Phone · 390 × 844</option>
            <option value="tablet">Tablet · 768 × 1024</option>
          </select>
        </div>
      )}
      {error && (
        <p className="desktop-browser-error" role="alert">
          {error}
        </p>
      )}
      {screen === 'page' ? (
        <div
          className="desktop-browser-viewport"
          ref={viewport}
          aria-label="Browser page"
        />
      ) : (
        <div className="desktop-browser-screen">
          <div className="desktop-browser-screen-header">
            <strong>
              {screen === 'history'
                ? 'History'
                : screen === 'downloads'
                  ? 'Downloads'
                  : screen === 'extensions'
                    ? 'Extensions'
                    : 'Browser settings'}
            </strong>
            <IconButton label="Back to page" onClick={() => setScreen('page')}>
              <X size={16} aria-hidden />
            </IconButton>
          </div>
          {screen === 'history' && (
            <ul>
              {history.map((entry, index) => (
                <li key={`${entry.visitedAt}:${index}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setScreen('page')
                      run(host.navigate(entry.url))
                    }}
                  >
                    <span>{entry.title}</span>
                    <small>{entry.url}</small>
                  </button>
                </li>
              ))}
              {!history.length && <li>No browsing history yet.</li>}
            </ul>
          )}
          {screen === 'downloads' && (
            <ul>
              {state?.downloads.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={item.status !== 'completed'}
                    onClick={() => run(host.openDownload(item.id))}
                  >
                    <span>{item.filename}</span>
                    <small>
                      {item.status === 'completed' ? 'Open file' : item.status}
                    </small>
                  </button>
                </li>
              ))}
              {!state?.downloads.length && <li>No downloads yet.</li>}
            </ul>
          )}
          {screen === 'extensions' && (
            <div className="desktop-browser-settings">
              <button type="button" onClick={() => run(host.addExtension())}>
                Load unpacked extension…
              </button>
              <ul>
                {state?.extensions.map((item) => (
                  <li key={item.id} className="desktop-browser-extension">
                    <span>
                      <strong>{item.name}</strong> {item.version}
                    </span>
                    <small>{item.status}</small>
                    <button
                      type="button"
                      onClick={() => run(host.removeExtension(item.id))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              {!state?.extensions.length && <p>No extensions loaded.</p>}
            </div>
          )}
          {screen === 'settings' && (
            <div className="desktop-browser-settings">
              <p>Site data and browsing history stay in this desktop app.</p>
              {updates && <DesktopUpdateControls host={updates} />}
              <button
                type="button"
                onClick={() =>
                  run(
                    host.clearData().then((cleared) => {
                      if (cleared) {
                        setHistory([])
                        setScreen('page')
                      }
                    }),
                  )
                }
              >
                Clear browsing data
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
