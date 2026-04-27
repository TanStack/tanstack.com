import * as React from 'react'
import { CodeBlock } from '~/components/markdown/CodeBlock.server'
import { Tabs, type TabDefinition } from '~/components/markdown/Tabs'
import type { Framework } from '~/libraries'

export interface LandingCodeExample {
  frameworks: Array<Framework>
  renderFallback?: (framework: Framework) => React.ReactNode
  title?: string
  codeByFramework: Partial<Record<Framework, { lang: string; code: string }>>
}

export function LandingCodeExampleCard({
  codeByFramework,
  frameworks,
  renderFallback,
  title = 'Just a quick look...',
}: LandingCodeExample) {
  const tabs: Array<TabDefinition> = frameworks.map((framework) => ({
    slug: framework,
    name: framework,
    headers: [],
  }))

  return (
    <div className="px-4 space-y-4 flex flex-col items-center">
      <div className="text-3xl font-black">{title}</div>
      <div className="max-w-full min-w-0">
        <Tabs tabs={tabs}>
          {frameworks.map((framework) => {
            const example = codeByFramework[framework]

            if (!example) {
              return (
                <div key={framework}>
                  {renderFallback ? renderFallback(framework) : null}
                </div>
              )
            }

            return (
              <CodeBlock
                key={framework}
                className="mt-0 border-0"
                showTypeCopyButton={false}
              >
                <code className={`language-${example.lang}`}>
                  {example.code}
                </code>
              </CodeBlock>
            )
          })}
        </Tabs>
      </div>
    </div>
  )
}
