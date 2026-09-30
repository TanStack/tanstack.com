import React from 'react'
import { ArrowSquareOutIcon } from '@phosphor-icons/react'
import { Button } from '~/ui'
import { stackBlitzIframeProps } from '~/utils/stackblitz-embed'

interface InteractiveSandboxProps {
  isActive: boolean
  codeSandboxUrl: string
  stackBlitzUrl: string
  examplePath: string
  libraryName: string
  embedEditor: 'codesandbox' | 'stackblitz'
}

export function InteractiveSandbox({
  isActive,
  codeSandboxUrl,
  stackBlitzUrl,
  examplePath,
  libraryName,
  embedEditor,
}: InteractiveSandboxProps) {
  const isStackBlitz = embedEditor === 'stackblitz'
  const [hasOpened, setHasOpened] = React.useState(isActive)
  React.useEffect(() => {
    if (isActive) setHasOpened(true)
  }, [isActive])
  if (!isActive && !hasOpened) return null

  const provider = isStackBlitz ? 'StackBlitz' : 'CodeSandbox'
  const embedUrl = isStackBlitz ? stackBlitzUrl : codeSandboxUrl
  const externalUrl = new URL(embedUrl)
  externalUrl.searchParams.delete('embed')

  // CodeSandbox's challenge responses forbid framing. Keep its editor usable
  // through a top-level navigation instead of showing a blocked iframe.
  if (!isStackBlitz) {
    return (
      <div
        className={`absolute inset-0 items-center justify-center bg-background-default p-6 ${isActive ? 'flex' : 'hidden'}`}
        aria-hidden={!isActive}
      >
        <div className="max-w-sm space-y-4 text-center">
          <p className="text-sm text-text-muted">
            Open this example in a new tab to use CodeSandbox's editor and
            preview.
          </p>
          <Button
            as="a"
            href={externalUrl.href}
            target="_blank"
            rel="noreferrer"
          >
            Open in CodeSandbox
            <ArrowSquareOutIcon className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`absolute inset-0 flex-col ${isActive ? 'flex' : 'hidden'}`}
      aria-hidden={!isActive}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-default bg-background-default px-4 py-2 text-sm">
        <span className="text-text-muted">
          If the embedded editor does not load, open it in a new tab.
        </span>
        <a
          href={externalUrl.href}
          target="_blank"
          rel="noreferrer"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          Open in {provider}
        </a>
      </div>
      <iframe
        src={embedUrl}
        title={`${provider} | ${libraryName} | ${examplePath}`}
        {...stackBlitzIframeProps}
        sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
        className="w-full min-h-0 flex-1 overflow-hidden bg-white dark:bg-black"
      />
    </div>
  )
}
