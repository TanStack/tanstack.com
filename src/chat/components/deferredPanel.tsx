import { LoadingState } from './ui/LoadingState'
import { Component, createRef, lazy, Suspense, type ComponentType } from 'react'

/** Keep a failed optional panel inside its panel. A rejected dynamic import
 * cannot be retried with the same URL, so recovery needs a fresh page load. */
export function deferredPanel<Props extends object>(
  load: () => Promise<{ default: ComponentType<Props> }>,
  label: string,
) {
  return class DeferredPanel extends Component<Props> {
    state = { failed: false, Panel: lazy(load) }

    static getDerivedStateFromError() {
      return { failed: true }
    }

    render() {
      const { Panel } = this.state
      return (
        <div role="region" aria-label={label}>
          {this.state.failed ? (
            <>
              <p role="alert">Couldn’t open {label}.</p>
              <button type="button" onClick={() => window.location.reload()}>
                Reload page
              </button>
            </>
          ) : (
            <Suspense
              fallback={<LoadingState inset>Loading {label}…</LoadingState>}
            >
              <Panel {...this.props} />
            </Suspense>
          )}
        </div>
      )
    }
  }
}
