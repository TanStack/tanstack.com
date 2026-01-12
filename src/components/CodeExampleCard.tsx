import { useState } from 'react'
import { Card } from '~/components/Card'
import { CodeBlock } from '~/components/markdown'
import { FrameworkIconTabs } from '~/components/FrameworkIconTabs'
import type { Framework } from '~/libraries'

interface CodeExampleCardProps {
  title?: string
  frameworks: Framework[]
  codeByFramework: Partial<Record<Framework, { lang: string; code: string }>>
}

export function CodeExampleCard({
  title = 'Just a quick look...',
  frameworks,
  codeByFramework,
}: CodeExampleCardProps) {
  const [framework, setFramework] = useState<Framework>(frameworks[0])

  const selected =
    codeByFramework[framework] || Object.values(codeByFramework)[0]

  if (!selected) return null

  return (
    <div className="px-4 space-y-4 flex flex-col items-center">
      <div className="text-3xl font-black">{title}</div>
      <Card className="group overflow-hidden max-w-full mx-auto [&_pre]:bg-transparent! [&_pre]:p-4!">
        <div>
          <FrameworkIconTabs
            frameworks={frameworks}
            value={framework}
            onChange={setFramework}
          />
          <CodeBlock className="mt-0 border-0" showTypeCopyButton={false}>
            <code className={`language-${selected.lang}`}>{selected.code}</code>
          </CodeBlock>
        </div>
      </Card>
    </div>
  )
}
