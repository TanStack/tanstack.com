import { CodeBlock } from '~/components/markdown/CodeBlock'
import type {
  ChartsCatalogAuthoredSource,
  ChartsCatalogDataset,
} from '~/utils/charts-catalog'

export function ChartsCatalogSource({
  source,
}: {
  source: ChartsCatalogAuthoredSource
}) {
  const chartLines = source.roles.entry.lines + source.roles.support.lines
  const fixtureLines = source.roles.fixture.lines

  return (
    <div className="space-y-3 p-4">
      <p className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-gray-500">
        <span>
          {[
            formatCount(chartLines, 'chart line'),
            fixtureLines
              ? formatCount(fixtureLines, 'data-selection line')
              : '',
            formatCount(source.totalFiles, 'file'),
            formatBytes(source.totalBytes),
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
        {source.excludedHarness.paths.length ? (
          <span>
            Benchmark harness excluded ·{' '}
            {source.excludedHarness.paths.join(', ')}
          </span>
        ) : null}
      </p>

      {source.datasets.map((dataset) => (
        <CatalogDataset key={dataset.id} dataset={dataset} />
      ))}

      {source.files.map((file) => (
        <details
          key={`${file.kind}:${file.path}`}
          open={file.kind !== 'fixture'}
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

function CatalogDataset({ dataset }: { dataset: ChartsCatalogDataset }) {
  return (
    <section
      aria-label={`${dataset.title} dataset`}
      className="rounded-lg border border-gray-200 px-4 py-3 text-xs text-gray-600 dark:border-gray-800 dark:text-gray-400"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <strong className="text-gray-950 dark:text-white">
          {dataset.title}
        </strong>
        <span>
          {formatCount(dataset.records, 'record')} · {dataset.format} ·{' '}
          {formatBytes(dataset.bytes)}
        </span>
      </div>
      <code className="mt-2 block text-gray-700 dark:text-gray-300">
        {dataset.specifier}
      </code>
      {dataset.selection ? (
        <p className="mt-2">Selection: {dataset.selection}</p>
      ) : null}
      {dataset.schema.length ? (
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {dataset.schema.map((field, index) => (
            <div key={`${field.name}:${index}`} className="flex gap-1">
              <dt className="font-medium text-gray-700 dark:text-gray-300">
                {field.name}
              </dt>
              <dd>{field.types.join(' | ')}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        <SafeLink href={dataset.sourceUrl}>{dataset.source}</SafeLink>
        <span>
          {dataset.observablePackage} · revision{' '}
          {dataset.observableRevision.slice(0, 12)} · {dataset.observableFile} ·{' '}
          {dataset.license} · SHA-256 {dataset.sha256.slice(0, 12)}
        </span>
        <SafeLink href={dataset.observableUrl}>Pinned snapshot</SafeLink>
      </p>
    </section>
  )
}

function SafeLink({ children, href }: { children: string; href: string }) {
  if (!isHttpUrl(href)) return <span>{children}</span>
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-blue-600 hover:underline dark:text-blue-400"
    >
      {children}
    </a>
  )
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function formatCount(value: number, noun: string) {
  return `${value.toLocaleString('en-US')} ${noun}${value === 1 ? '' : 's'}`
}

function formatBytes(value: number) {
  if (value < 1_000) return `${value} B`
  if (value < 1_000_000) return `${(value / 1_000).toFixed(1)} kB`
  return `${(value / 1_000_000).toFixed(1)} MB`
}
