import { createFileRoute, Link } from '@tanstack/react-router'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/application-starter/docs')({
  component: RouteComponent,
  head: () => ({
    meta: seo({
      title: 'TanStack Application Starter Docs',
      description:
        'Learn how to use TanStack Application Starter to create and customize TanStack Start projects',
    }),
  }),
})

function RouteComponent() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-12">
          <Link
            to="/application-starter"
            className="text-sm text-blue-600 dark:text-cyan-400 hover:underline mb-4 inline-block"
          >
            Back to Application Starter
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            TanStack Application Starter
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            A visual tool for scaffolding TanStack Start projects with your
            preferred integrations.
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-gray dark:prose-invert max-w-none space-y-12">
          {/* How It Works */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              How It Works
            </h2>
            <ol className="list-decimal pl-6 text-gray-600 dark:text-gray-400 space-y-3">
              <li>
                <strong>Choose a template</strong> or begin with a blank project
              </li>
              <li>
                <strong>Add integrations</strong> for auth, database,
                deployment, and more
              </li>
              <li>
                <strong>Preview the generated code</strong> in the file explorer
              </li>
              <li>
                <strong>Copy the CLI command</strong> or download your project
              </li>
            </ol>
          </section>

          {/* Templates */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Templates
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Templates are pre-configured integration combinations for common
              use cases. Select one to instantly configure your project, then
              customize by adding or removing integrations.
            </p>
          </section>

          {/* Integrations */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Integrations
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Integrations add functionality to your project: files,
              dependencies, configuration, and code injections. The application
              starter automatically handles dependencies and conflicts between
              integrations.
            </p>
          </section>

          {/* Custom Templates & Integrations */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Custom Templates & Integrations
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You can import custom templates and integrations by URL. Use "Save
              as Template" in the Build Project dropdown to export your current
              configuration as a shareable JSON file.
            </p>
          </section>

          {/* CLI */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Using the CLI
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              The application starter generates commands for the TanStack CLI.
              You can also use the CLI directly:
            </p>
            <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm">
              {`npx @tanstack/cli create my-app`}
            </pre>
            <p className="text-gray-600 dark:text-gray-400 mt-4">
              For full CLI documentation, see the{' '}
              <Link
                to="/$libraryId/$version/docs"
                params={{ libraryId: 'cli', version: 'latest' }}
                className="text-blue-600 dark:text-cyan-400 hover:underline"
              >
                TanStack CLI docs
              </Link>
              .
            </p>
          </section>
        </div>

        {/* Footer CTA */}
        <div className="mt-16 p-8 bg-linear-to-r from-blue-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/20 rounded-2xl border border-blue-200 dark:border-cyan-800 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Ready to Build?
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Start creating your TanStack Start project with the visual
            application starter.
          </p>
          <Link
            to="/application-starter"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 dark:bg-cyan-600 text-white font-semibold rounded-lg hover:bg-blue-700 dark:hover:bg-cyan-700 transition-colors"
          >
            Open Application Starter
          </Link>
        </div>
      </div>
    </div>
  )
}
