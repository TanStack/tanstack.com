import * as React from 'react'
import { FaCopy, FaRegCopy } from 'react-icons/fa'
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
    <div className={`${props.className} w-full max-w-full relative not-prose`}>
      <div className="absolute flex items-stretch bg-white text-sm z-10 border border-gray-500/20 rounded-md -top-3 right-2 dark:bg-gray-800 overflow-hidden divide-x divide-gray-500/20">
        {lang ? <div className="px-2">{lang}</div> : null}
        <button
          className="px-2 flex items-center text-gray-500 hover:bg-gray-500 hover:text-gray-100 dark:hover:text-gray-200 transition duration-200"
          onClick={() => {
            navigator.clipboard.writeText(ref.current?.innerText || '')
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          aria-label="Copy code to clipboard"
        >
          {copied ? <span className="text-xs">Copied!</span> : <FaRegCopy />}
        </button>
      </div>
      <pre
        className={`m-0 rounded-md w-full border border-gray-500/20 dark:border-gray-500/30`}
        style={props.style}
        ref={ref}
      >
        {props.children}
      </pre>
    </div>
  )
}
