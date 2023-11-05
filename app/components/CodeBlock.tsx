import type { FC, HTMLAttributes } from 'react'
import invariant from 'tiny-invariant'

function getLanguageFromChildren(children: any): string {
  const language = children[0]?.props?.children
  return language ? language : ''
}

export const CodeBlock: FC<HTMLAttributes<HTMLPreElement>> = (props) => {
  const { children, className, style } = props
  invariant(!!children, 'children is required')
  const userLang = getLanguageFromChildren(children)
  return (
    <div className="w-full max-w-full">
      <div className="relative not-prose">
        <div
          className="absolute bg-white text-sm z-10 border border-gray-300 px-2 rounded-md -top-3 right-2
            dark:bg-gray-600 dark:border-0"
        >
          {userLang}
        </div>
        <div
          className="rounded-md font-normal w-full border border-gray-200
              dark:border-0"
        >
          <pre className={`${className} border-none m-0`} style={style}>
            {children}
          </pre>
        </div>
      </div>
    </div>
  )
}
