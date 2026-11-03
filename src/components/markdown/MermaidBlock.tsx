import { mount, register } from 'pele/core'
import flowchart from 'pele/diagrams/flowchart'
import * as React from 'react'
import { twMerge } from 'tailwind-merge'

register(flowchart)

export function MermaidBlock({
  className,
  code,
  style,
  title,
}: {
  className?: string
  code: string
  style?: React.CSSProperties
  title?: string
}) {
  const mountDiagram = React.useCallback(
    (container: HTMLDivElement | null) => {
      if (!container) return

      const diagram = mount(container, code, {
        // Keep diagrams from navigating or loading remote images.
        links: false,
        images: false,
        zoom: false,
      })

      return () => {
        diagram.destroy()
      }
    },
    [code],
  )

  return (
    <div
      ref={mountDiagram}
      className={twMerge(
        'mermaid-block not-prose w-full min-w-0 max-w-full overflow-hidden rounded-md border border-gray-500/20 bg-white p-4 dark:bg-gray-950 [&_svg]:mx-auto',
        className,
      )}
      style={style}
      role="group"
      aria-label={title ?? 'Mermaid diagram'}
    />
  )
}
