import {
  useState,
  type FC,
  type HTMLAttributes,
  type ReactElement,
} from 'react'
import invariant from 'tiny-invariant'
import type { Language } from 'prism-react-renderer'
import { Highlight, Prism } from 'prism-react-renderer'
import { FaCopy } from 'react-icons/fa'
import { svelteHighlighter } from '~/utils/svelteHighlighter'
// Add back additional language support after `prism-react` upgrade
;(typeof global !== 'undefined' ? global : window).Prism = Prism
require('prismjs/components/prism-diff')
require('prismjs/components/prism-bash')

// @ts-ignore Alias markup as vue highlight
Prism.languages.vue = Prism.languages.markup

// Enable svelte syntax highlighter
svelteHighlighter()

function getLanguageFromClassName(className: string) {
  const match = className.match(/language-(\w+)/)
  return match ? match[1] : ''
}

function isLanguageSupported(lang: string): lang is Language {
  return lang in Prism.languages
}

export const CodeBlock: FC<HTMLAttributes<HTMLPreElement>> = ({ children }) => {
  invariant(!!children, 'children is required')
  const [copied, setCopied] = useState(false)
  const child = children as ReactElement
  const className = child.props?.className || ''
  const userLang = getLanguageFromClassName(className)
  const lang = isLanguageSupported(userLang) ? userLang : 'bash'
  const code = child.props.children || ''
  return (
    <div className="w-full max-w-full relative">
      <button
        className="absolute right-1 top-3 z-10 p-2 group flex items-center"
        onClick={() => {
          setCopied(true)
          navigator.clipboard.writeText(code.trim())
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
      <Highlight code={code.trim()} language={lang}>
        {({ className, tokens, getLineProps, getTokenProps }) => (
          <div className="relative not-prose">
            <div
              className="absolute bg-white text-sm z-10 border border-gray-300 px-2 rounded-md -top-3 right-2
            dark:bg-gray-600 dark:border-0"
            >
              {lang}
            </div>
            <div
              className="rounded-md font-normal w-full border border-gray-200
              dark:border-0"
            >
              <pre className={`overflow-scroll ${className}`} style={{}}>
                <code className={className} style={{}}>
                  {tokens.map((line, i) => (
                    <div key={i} {...getLineProps({ line, key: i })} style={{}}>
                      {line.map((token, key) => (
                        <span
                          key={key}
                          {...getTokenProps({ token, key })}
                          style={{}}
                        />
                      ))}
                    </div>
                  ))}
                </code>
              </pre>
            </div>
          </div>
        )}
      </Highlight>
    </div>
  )
}
