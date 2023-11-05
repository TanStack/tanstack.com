import type { FC, HTMLAttributes } from 'react'
import invariant from 'tiny-invariant'

function getLanguageFromChildren(children: any): string | undefined {
  const language = children[0]?.props?.children
  return language ? language : undefined
}

export const CodeBlock: FC<HTMLAttributes<HTMLPreElement>> = (props) => {
  const { children, className, style } = props
  invariant(!!children, 'children is required')
  const lang = getLanguageFromChildren(children)
  return (
    <div className="relative not-prose w-full max-w-full">
      {lang && (
        <div
          className="absolute bg-white text-sm z-10 border border-gray-300 px-2 rounded-md -top-3 right-2
            dark:bg-gray-600 dark:border-0"
        >
          {lang}
        </div>
      )}
      <pre
        className={`${className} dark:border-0 m-0 rounded-md w-full border border-gray-200`}
        style={style}
      >
        {children}
      </pre>
    </div>
  )
}
