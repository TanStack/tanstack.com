import React from 'react'

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
  return (
    <div
      className={`absolute inset-0 ${
        isActive ? '' : 'pointer-events-none opacity-0'
      }`}
      aria-hidden={!isActive}
    >
      <iframe
        src={embedEditor === 'codesandbox' ? codeSandboxUrl : stackBlitzUrl}
        title={`${libraryName} | ${examplePath}`}
        sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
        className="w-full h-full min-h-[80dvh] overflow-hidden shadow-xl shadow-gray-700/20 bg-white dark:bg-black"
      />
    </div>
  )
}
