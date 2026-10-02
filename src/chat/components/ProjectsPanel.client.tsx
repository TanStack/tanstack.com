import { useWorkspaceSearch } from './useWorkspaceSearch'
import { validateWorkspaceSearch } from '../core/navigation'
import { useNavigate } from '@tanstack/react-router'
import { lazy, Suspense, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createBuilderProject,
  listBuilderProjects,
} from '~/utils/builder-project.client'
import { createBuilderProjectFromTemplateId } from '~/utils/builder-project-draft'
import { builderExamples } from '~/utils/builder-examples'
import { SelectField } from './SelectField'
import { Button } from './ui/Button'
import './projects-panel.css'
const ProjectEditor = lazy(() =>
  import('~/chat/components/projects/ProjectPage.client').then((module) => ({
    default: module.BuilderProjectPage,
  })),
)

export function ProjectsPanel({ userId }: { userId: string }) {
  const client = useQueryClient()
  const { project: selected, projectTemplate } = useWorkspaceSearch()
  const navigate = useNavigate()
  const setSelected = (project: string) =>
    navigate({
      to: '.',
      search: (previous: Record<string, unknown>) => ({
        ...validateWorkspaceSearch(previous),
        project,
        projectTemplate: undefined,
      }),
      replace: true,
    })
  const beforeLeaveRef = useRef<(() => Promise<void>) | null>(null)
  const [switchError, setSwitchError] = useState('')
  const [switching, setSwitching] = useState(false)
  const template = projectTemplate ?? 'blank'
  const setTemplate = (value: string) => {
    void navigate({
      to: '.',
      search: (previous: Record<string, unknown>) => ({
        ...validateWorkspaceSearch(previous),
        projectTemplate: value,
      }),
      replace: true,
    })
  }
  const queryKey = ['chat-projects', userId]
  const projects = useQuery({ queryKey, queryFn: listBuilderProjects })
  const create = useMutation({
    mutationFn: async () => {
      await beforeLeaveRef.current?.()
      const project = createBuilderProjectFromTemplateId(template)
      if (!project) throw new Error('This project template is unavailable.')
      return createBuilderProject(project)
    },
    onSuccess: async (project) => {
      await setSelected(project.id)
      await client.invalidateQueries({ queryKey })
    },
  })
  const active = selected ?? projects.data?.[0]?.id
  const open = async (id: string) => {
    if (id === active) return
    setSwitching(true)
    setSwitchError('')
    try {
      await beforeLeaveRef.current?.()
      await setSelected(id)
      await client.invalidateQueries({ queryKey })
    } catch (error) {
      setSwitchError(
        error instanceof Error
          ? error.message
          : 'Could not save the current project.',
      )
    } finally {
      setSwitching(false)
    }
  }
  return (
    <div className="projects-panel">
      <div className="projects-panel-controls">
        {projects.data?.length ? (
          <SelectField
            aria-label="Project"
            value={active}
            items={projects.data.map((project) => ({
              value: project.id,
              label: project.title,
            }))}
            disabled={switching || create.isPending}
            onValueChange={(id) => {
              void open(id)
            }}
          />
        ) : null}
        <SelectField
          aria-label="New project template"
          value={template}
          items={[
            { value: 'blank', label: 'Blank project' },
            ...builderExamples.map((example) => ({
              value: example.id,
              label: example.title,
            })),
          ]}
          disabled={switching || create.isPending}
          onValueChange={setTemplate}
        />
        <Button
          disabled={create.isPending || switching}
          onClick={() => create.mutate()}
        >
          New project
        </Button>
      </div>
      {projects.isPending ? <p role="status">Loading projects…</p> : null}
      {projects.error ? <p role="alert">{projects.error.message}</p> : null}
      {switchError ? <p role="alert">{switchError}</p> : null}
      {create.error ? <p role="alert">{create.error.message}</p> : null}
      {active ? (
        <div className="projects-panel-editor">
          <Suspense fallback={<p role="status">Opening project…</p>}>
            <ProjectEditor
              key={active}
              id={active}
              embedded
              beforeLeaveRef={beforeLeaveRef}
              onOpenProject={open}
            />
          </Suspense>
        </div>
      ) : null}
    </div>
  )
}
