import { FaEdit } from 'react-icons/fa'
import { DocTitle } from './DocTitle'
import { Mdx } from './Mdx'

export function Doc({
  title,
  code,
  repo,
  branch,
  filePath,
}: {
  title: string
  code: string
  repo: string
  branch: string
  filePath: string
}) {
  return (
    <div className="p-4 lg:p-6 overflow-auto w-full">
      {title ? <DocTitle>{title}</DocTitle> : null}
      <div className="h-4" />
      <div className="h-px bg-gray-500 opacity-20" />
      <div className="h-4" />
      <div className="prose prose-gray prose-sm dark:prose-invert max-w-none">
        <Mdx code={code} />
      </div>
      <div className="h-12" />
      <div className="w-full h-px bg-gray-500 opacity-30" />
      <div className="py-4 opacity-70">
        <a
          href={`https://github.com/${repo}/tree/${branch}/${filePath}`}
          className="flex items-center gap-2"
        >
          <FaEdit /> Edit on GitHub
        </a>
      </div>
      <div className="h-24" />
    </div>
  )
}
