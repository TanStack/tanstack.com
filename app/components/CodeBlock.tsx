import * as React from 'react'
import { FaCopy } from 'react-icons/fa'
import invariant from 'tiny-invariant'

function getLanguageFromChildren(children: any): string | undefined {
  const language = children[0]?.props?.children
  return language ? language : undefined
}

export const CodeBlock = (props: React.HTMLProps<HTMLPreElement>) => {
  invariant(!!props.children, 'children is required')
  const lang = getLanguageFromChildren(props.children)
  const [copied, setCopied] = React.useState(false)
  const ref = React.useRef<HTMLPreElement>(null)

  return (
    <div className="w-full max-w-full relative">
      <button
        className="absolute right-1 top-3 z-10 p-2 group flex items-center"
        onClick={() => {
          navigator.clipboard.writeText(ref.current?.innerText || '')
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        }}
        aria-label="Copy code to clipboard"
      >
        {copied ? (
          <span className="text-xs">Copied!</span>
        ) : (
          <FaCopy className="text-gray-500 group-hover:text-gray-100 dark:group-hover:text-gray-200 transition duration-200" />
        )}
      </button>
      <div className="relative not-prose w-full max-w-full">
        {lang ? (
          <div className="absolute bg-white text-sm z-10 border border-gray-500/20 px-2 rounded-md -top-3 right-2 dark:bg-gray-600">
            {lang}
          </div>
        ) : null}
        <pre
          className={`${props.className} m-0 rounded-md w-full border border-gray-500/20 dark:border-gray-500/30`}
          style={props.style}
          ref={ref}
        >
          {props.children}
        </pre>
      </div>
    </div>
  )
}
