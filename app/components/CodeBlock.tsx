import type { FC, HTMLAttributes, ReactElement } from 'react'
import { Children } from 'react'
import invariant from 'tiny-invariant'
import type { Language } from 'prism-react-renderer'
import Highlight, { defaultProps } from 'prism-react-renderer'

function getLanguageFromClassName(className: string) {
  const match = className.match(/language-(\w+)/)
  return match ? match[1] : ''
}

function isLanguageSupported(lang: string): lang is Language {
  return (
    lang === 'markup' ||
    lang === 'bash' ||
    lang === 'clike' ||
    lang === 'c' ||
    lang === 'cpp' ||
    lang === 'css' ||
    lang === 'javascript' ||
    lang === 'js' ||
    lang === 'jsx' ||
    lang === 'coffeescript' ||
    lang === 'actionscript' ||
    lang === 'css-extr' ||
    lang === 'diff' ||
    lang === 'git' ||
    lang === 'go' ||
    lang === 'graphql' ||
    lang === 'handlebars' ||
    lang === 'json' ||
    lang === 'less' ||
    lang === 'makefile' ||
    lang === 'markdown' ||
    lang === 'objectivec' ||
    lang === 'ocaml' ||
    lang === 'python' ||
    lang === 'reason' ||
    lang === 'sass' ||
    lang === 'scss' ||
    lang === 'sql' ||
    lang === 'stylus' ||
    lang === 'tsx' ||
    lang === 'typescript' ||
    lang === 'wasm' ||
    lang === 'yaml'
  )
}

export const CodeBlock: FC<HTMLAttributes<HTMLPreElement>> = ({ children }) => {
  invariant(!!children, 'children is required')
  const child = children as ReactElement
  const className = child.props?.className || ''
  const userLang = getLanguageFromClassName(className)
  const lang = isLanguageSupported(userLang) ? userLang : 'bash'
  const code = child.props.children || ''
  return (
    <div className="w-full max-w-full">
      <Highlight {...defaultProps} code={code.trim()} language={lang || 'bash'}>
        {({ className, tokens, getLineProps, getTokenProps }) => (
          <div className="relative not-prose">
            <div
              className="absolute bg-white text-sm z-10 border border-gray-300 px-2 rounded-md -top-3 right-2
            dark:bg-gray-600 dark:border-0"
            >
              {lang || 'text'}
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
