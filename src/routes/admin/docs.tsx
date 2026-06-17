import { createFileRoute } from '@tanstack/react-router'
import { DocsCacheTab } from '~/components/admin/DocsCacheTab'

export const Route = createFileRoute('/admin/docs')({
  component: DocsAdminPage,
})

function DocsAdminPage() {
  return (
    <div className="w-full p-4">
      <div className="mx-auto max-w-7xl">
        <DocsCacheTab />
      </div>
    </div>
  )
}
