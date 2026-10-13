import { Home, Search, Settings, PanelLeft, Plus } from 'lucide-react'

export function WorkspaceSkeleton() {
  return (
    <div className="app-shell" aria-busy="true" aria-label="Loading TanChat">
      <aside className="workspace-rail" aria-label="App navigation">
        <a className="workspace-rail-brand" href="/" aria-label="TanStack home">
          <span className="workspace-rail-brand-mark" aria-hidden="true" />
        </a>
        <button
          className="workspace-loading-icon"
          disabled
          aria-label="Sidebar"
        >
          <PanelLeft size={20} />
        </button>
        <button className="workspace-loading-icon" disabled aria-label="Home">
          <Home size={20} />
        </button>
        <button
          className="workspace-loading-icon workspace-rail-settings"
          disabled
          aria-label="Settings"
        >
          <Settings size={20} />
        </button>
      </aside>
      <div className="workspace-content">
        <aside
          className="sidebar workspace-loading-sidebar"
          aria-label="Workspace navigation"
        >
          <div className="brand">
            <strong>TanChat</strong>
            <div className="brand-search">
              <button
                className="workspace-loading-icon"
                disabled
                aria-label="Search"
              >
                <Search size={17} />
              </button>
            </div>
          </div>
          <div className="personal-assistant">
            <div className="workspace-skeleton workspace-skeleton-assistant" />
          </div>
          <div
            className="bw-heading workspace-loading-toolbar"
            aria-hidden="true"
          >
            <div className="workspace-skeleton" style={{ width: 40 }} />
          </div>
          <button className="workspace-loading-new" disabled>
            <Plus size={16} /> New Chat
          </button>
          <div className="workspace-skeleton-list" aria-hidden="true">
            {[72, 90, 58, 80, 65].map((width, index) => (
              <div
                key={index}
                className="workspace-skeleton"
                style={{ width: `${width}%` }}
              />
            ))}
          </div>
        </aside>
        <main className="main workspace-loading-main">
          <header className="main-header">
            <div className="workspace-skeleton workspace-skeleton-title" />
          </header>
          <div className="workspace-loading-body" aria-hidden="true">
            <div className="workspace-skeleton workspace-skeleton-message" />
            <div className="workspace-skeleton workspace-skeleton-message short" />
          </div>
          <div className="composer-area">
            <div
              className="workspace-skeleton workspace-skeleton-composer"
              aria-hidden="true"
            />
          </div>
        </main>
      </div>
    </div>
  )
}
