import * as React from 'react'
import {
  ArrowRightIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  SparkleIcon,
  SpinnerGapIcon,
  TrashIcon,
} from '@phosphor-icons/react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { Button } from '~/components/ds/ui'
import { BuilderListSkeletonRows } from '~/components/builder/BuilderLoading'
import type { SharedExampleProject } from '~/utils/example-project'
import {
  blankBuilderProject,
  clearBuilderProjectDraft,
  createBuilderProjectDraftId,
  createBuilderTemplateProject,
  getBrowserBuilderProjectDraftStorage,
  loadBuilderProjectDraft,
  saveBuilderProjectDraft,
} from '~/utils/builder-project-draft'
import {
  deleteBuilderProject,
  listBuilderProjects,
} from '~/utils/builder-project.client'
import type { BuilderProject } from '~/utils/builder-project'
import { builderExamples } from '~/utils/builder-examples'

export function BuilderIndexPage() {
  const navigate = useNavigate()
  const userQuery = useCurrentUserQuery()
  const user = userQuery.data
  const [draftStorage] = React.useState(getBrowserBuilderProjectDraftStorage)
  const [draft, setDraft] = React.useState(() =>
    loadBuilderProjectDraft(draftStorage),
  )
  const [projects, setProjects] = React.useState<Array<BuilderProject>>([])
  const [loadingProjects, setLoadingProjects] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState('')
  const [query, setQuery] = React.useState('')
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (!user) {
      setProjects([])
      return
    }

    let active = true
    setLoadingProjects(true)
    setError('')

    void listBuilderProjects()
      .then((nextProjects) => {
        if (active) setProjects(nextProjects)
      })
      .catch((cause: unknown) => {
        if (active) setError(formatError(cause))
      })
      .finally(() => {
        if (active) setLoadingProjects(false)
      })

    return () => {
      active = false
    }
  }, [user])

  async function startDraft(project: SharedExampleProject, template: string) {
    if (
      draft &&
      !window.confirm(`Replace your local draft “${draft.project.title}”?`)
    ) {
      return
    }

    const updatedAt = new Date().toISOString()
    const nextDraft = { id: createBuilderProjectDraftId(), project, updatedAt }
    const stored = saveBuilderProjectDraft(draftStorage, nextDraft, updatedAt)
    if (!stored && draft) {
      setError('Unable to replace the local draft in this browser.')
      return
    }
    if (stored) setDraft(nextDraft)
    await navigate({
      to: '/builder/new',
      search: { template },
    })
  }

  function removeDraft() {
    if (
      !draft ||
      !window.confirm(`Delete local draft “${draft.project.title}”?`)
    ) {
      return
    }

    if (!clearBuilderProjectDraft(draftStorage)) {
      setError('Unable to delete the local draft from this browser.')
      return
    }

    setDraft(undefined)
  }

  async function remove(project: BuilderProject) {
    if (
      !window.confirm(
        `Remove “${project.title}” from your projects? Its project link will stop working. Previously shared snapshot URLs will keep working.`,
      )
    ) {
      return
    }

    setDeletingId(project.id)
    setError('')

    try {
      await deleteBuilderProject(project)
      setProjects((current) => current.filter((item) => item.id !== project.id))
    } catch (cause) {
      setError(formatError(cause))
    } finally {
      setDeletingId('')
    }
  }

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleProjects = normalizedQuery
    ? projects.filter((project) =>
        `${project.title}\n${project.description}`
          .toLocaleLowerCase()
          .includes(normalizedQuery),
      )
    : projects

  return (
    <main className="min-h-[calc(100dvh-var(--navbar-height))] bg-background-default px-5 py-12 text-text-primary sm:px-8 sm:py-16">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            TanStack Builder
          </h1>
          <div className="flex items-center gap-2">
            {import.meta.env.DEV ? (
              <Button as={Link} to="/builder/ai" variant="ghost" size="sm">
                <SparkleIcon className="size-4" aria-hidden="true" />
                AI spike
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              onClick={() => void startDraft(blankBuilderProject, 'blank')}
            >
              <PlusIcon className="size-4" aria-hidden="true" />
              New project
            </Button>
          </div>
        </header>

        <p className="mt-3 text-sm text-text-muted">
          Drafts stay in this browser until you save.
        </p>

        {error ? (
          <p
            className="mt-6 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-text-error"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {draft ? (
          <section className="mt-12" aria-labelledby="local-draft-heading">
            <h2 id="local-draft-heading" className="text-lg font-semibold">
              Local draft
            </h2>
            <div className="mt-4 border-y border-border-default">
              <div className="group flex items-center gap-3 px-1 sm:px-3">
                <Link
                  to="/builder/new"
                  className="min-w-0 flex-1 py-5 outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                >
                  <span className="block truncate font-medium">
                    {draft.project.title}
                  </span>
                  <span className="mt-1 block text-sm text-text-muted">
                    Updated {formatUpdatedAt(draft.updatedAt)}
                  </span>
                </Link>
                <Button
                  type="button"
                  variant="icon"
                  color="gray"
                  size="icon-sm"
                  aria-label={`Delete local draft ${draft.project.title}`}
                  onClick={removeDraft}
                >
                  <TrashIcon className="size-4" aria-hidden="true" />
                </Button>
                <ArrowRightIcon
                  className="size-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </div>
            </div>
          </section>
        ) : null}

        {userQuery.isPending ? (
          <section
            className="mt-14"
            aria-busy="true"
            aria-labelledby="loading-projects-heading"
          >
            <h2 id="loading-projects-heading" className="text-lg font-semibold">
              Your projects
            </h2>
            <span className="sr-only">Loading projects</span>
            <div
              className="mt-4 border-y border-border-default"
              aria-hidden="true"
            >
              <BuilderListSkeletonRows />
            </div>
          </section>
        ) : user ? (
          <section className="mt-14" aria-labelledby="your-projects-heading">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 id="your-projects-heading" className="text-lg font-semibold">
                Your projects
              </h2>
              {projects.length > 4 ? (
                <label className="relative block w-full sm:w-64">
                  <MagnifyingGlassIcon
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted"
                    aria-hidden="true"
                  />
                  <span className="sr-only">Search your projects</span>
                  <input
                    type="search"
                    value={query}
                    placeholder="Search projects"
                    onChange={(event) => setQuery(event.target.value)}
                    className="h-9 w-full rounded-full border border-border-default bg-background-subtle pr-4 pl-9 text-sm outline-none placeholder:text-text-muted focus:border-border-focus focus:ring-2 focus:ring-border-focus/30"
                  />
                </label>
              ) : null}
            </div>

            <div className="mt-4 border-y border-border-default">
              {loadingProjects ? (
                <BuilderListSkeletonRows />
              ) : visibleProjects.length ? (
                visibleProjects.map((project) => (
                  <div
                    key={project.id}
                    className="group flex items-center gap-3 border-b border-border-default px-1 last:border-b-0 sm:px-3"
                  >
                    <Link
                      to="/builder/$id"
                      params={{ id: project.id }}
                      className="min-w-0 flex-1 py-5 outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                    >
                      <span className="block truncate font-medium">
                        {project.title}
                      </span>
                      <span className="mt-1 flex min-w-0 items-center gap-2 text-sm text-text-muted">
                        {project.description ? (
                          <span className="truncate">
                            {project.description}
                          </span>
                        ) : null}
                        <span className="shrink-0">
                          Updated {formatUpdatedAt(project.updatedAt)}
                        </span>
                      </span>
                    </Link>
                    <Button
                      type="button"
                      variant="icon"
                      color="gray"
                      size="icon-sm"
                      aria-label={`Remove ${project.title} from your projects`}
                      disabled={deletingId === project.id}
                      onClick={() => void remove(project)}
                    >
                      {deletingId === project.id ? (
                        <SpinnerGapIcon
                          className="size-4 animate-spin motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                      ) : (
                        <TrashIcon className="size-4" aria-hidden="true" />
                      )}
                    </Button>
                    <ArrowRightIcon
                      className="size-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </div>
                ))
              ) : (
                <p className="px-1 py-6 text-sm text-text-muted">
                  {normalizedQuery
                    ? 'No projects match your search.'
                    : 'No projects yet.'}
                </p>
              )}
            </div>
          </section>
        ) : null}

        <section className="mt-14" aria-labelledby="examples-heading">
          <h2 id="examples-heading" className="text-lg font-semibold">
            Start from an example
          </h2>
          <div className="mt-4 border-y border-border-default">
            {builderExamples.map((example) => {
              const project = createBuilderTemplateProject(example)

              return (
                <div
                  key={example.id}
                  className="flex items-center gap-5 border-b border-border-default px-1 py-5 last:border-b-0 sm:px-3"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium">{example.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-text-muted">
                      {example.description}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void startDraft(project, example.id)}
                  >
                    Use template
                  </Button>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </main>
  )
}

function formatUpdatedAt(value: string) {
  const date = new Date(value)
  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  })
  return formatter.format(date)
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
