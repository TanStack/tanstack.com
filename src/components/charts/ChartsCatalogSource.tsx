import { CodeBlock } from '~/components/markdown/CodeBlock'
import type { ChartsCatalogAuthoredSource } from '~/utils/charts-catalog'

export function ChartsCatalogSource({
  source,
}: {
  source: ChartsCatalogAuthoredSource
}) {
  return (
    <div className="space-y-3 p-4">
      <p className="text-xs text-gray-500">
        {[
          formatCount(source.totalLines, 'line'),
          formatCount(source.totalFiles, 'file'),
          formatBytes(source.totalBytes),
        ].join(' · ')}
      </p>

      {source.files.map((file) => (
        <details
          key={`${file.kind}:${file.path}`}
          open={file.kind === 'entry'}
          className="min-w-0 rounded-lg border border-gray-200 dark:border-gray-800"
        >
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
            <span>{file.path}</span>
            <span>
              {formatCount(file.lines, 'line')} · {file.kind}
            </span>
          </summary>
          <CodeBlock
            data-code-title={file.path}
            showTypeCopyButton={false}
            className="max-h-[32rem] rounded-none border-x-0 border-b-0 [&_pre]:max-h-[32rem] [&_pre]:overflow-auto"
          >
            <code className="language-ts">{file.source}</code>
          </CodeBlock>
        </details>
      ))}
    </div>
  )
}

function formatCount(value: number, noun: string) {
  return `${value.toLocaleString('en-US')} ${noun}${value === 1 ? '' : 's'}`
}

function formatBytes(value: number) {
  if (value < 1_000) return `${value} B`
  if (value < 1_000_000) return `${(value / 1_000).toFixed(1)} kB`
  return `${(value / 1_000_000).toFixed(1)} MB`
}
