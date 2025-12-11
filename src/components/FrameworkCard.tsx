import { Link } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import { FaCheck, FaCopy } from 'react-icons/fa'
import { Library } from '~/libraries'
import { getFrameworkOptions } from '~/libraries/frameworks'
import { useCopyButton } from '~/components/CopyMarkdownButton'
import { useToast } from '~/components/ToastProvider'

export function FrameworkCard({
  framework,
  libraryId,
  packageName,
  index,
  library,
}: {
  framework: ReturnType<typeof getFrameworkOptions>[number]
  libraryId: string
  packageName: string
  index: number
  library: Library
}) {
  const { notify } = useToast()
  const [copied, onCopyClick] = useCopyButton(async () => {
    await navigator.clipboard.writeText(packageName)
    notify(
      <div>
        <div className="font-medium">Copied package name</div>
        <div className="text-gray-500 dark:text-gray-400 text-xs">
          {packageName} copied to clipboard
        </div>
      </div>,
    )
  })

  const hasCustomInstallPath = !!library.installPath
  const installationPath = library.installPath
    ? library.installPath
        .replace('$framework', framework.value)
        .replace('$libraryId', libraryId)
    : 'installation'

  // Add framework hash fragment only for default installation pages (when installPath is not defined)
  // Link component adds the # automatically, so we just pass the value without #
  const installationHash = !hasCustomInstallPath ? framework.value : undefined

  return (
    <div
      className={twMerge(
        'border-2 border-gray-200 dark:border-gray-800/50 rounded-xl',
        'shadow-md p-6 transition-all duration-300 ease-out',
        'bg-white/90 dark:bg-black/40 backdrop-blur-sm',
        'hover:shadow-xl hover:-translate-y-1',
        'flex flex-col gap-4 group',
        'min-h-[180px]',
        'relative',
      )}
      style={{
        zIndex: index,
        willChange: 'transform',
      }}
    >
      <Link
        from="/$libraryId/$version/docs"
        to="./$"
        params={{
          _splat: installationPath,
        }}
        hash={installationHash}
        className="flex flex-col flex-1 gap-4"
      >
        {/* Framework Logo */}
        <div className="flex-shrink-0 flex justify-center">
          <img
            src={framework.logo}
            alt={framework.label}
            loading='lazy'
            className="w-16 h-16 object-contain transition-transform duration-300 group-hover:scale-110"
          />
        </div>

        {/* Framework Name */}
        <div className="text-center flex-1 flex items-center justify-center">
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {framework.label}
          </div>
        </div>
      </Link>

      {/* Package Name with Copy Button - Bottom of Card */}
      <div className="pt-2 border-t border-gray-200 dark:border-gray-800 space-y-2">
        <div className="flex items-center justify-center gap-2">
          <code className="text-xs text-gray-600 dark:text-gray-400 font-mono">
            {packageName}
          </code>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onCopyClick(e)
            }}
            className="flex-shrink-0 p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Copy package name"
          >
            {copied ? (
              <FaCheck className="w-3 h-3 text-green-600 dark:text-green-400" />
            ) : (
              <FaCopy className="w-3 h-3" />
            )}
          </button>
        </div>
        <Link
          from="/$libraryId/$version/docs"
          to="./$"
          params={{
            _splat: installationPath,
          }}
          hash={installationHash}
          className="block w-full text-center text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 underline transition-colors"
        >
          Full install instructions
        </Link>
      </div>

      {/* Accent indicator */}
      <div
        className={twMerge(
          'absolute bottom-0 left-0 right-0 h-1 rounded-b-xl',
          'transition-opacity duration-300',
          'opacity-0 group-hover:opacity-100',
          framework.color,
        )}
      />
    </div>
  )
}
