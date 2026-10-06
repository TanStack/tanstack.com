import { LoadingState } from './ui/LoadingState'
import { useQuery } from '@tanstack/react-query'
import { skillVersionSchema } from '../core/skills'
import { kodyReferenceDetailSchema } from '../core/kody-reference-detail'
import { ApiError, useWorkspaceApi } from './WorkspaceApi'
import { SkillPreview } from './SkillPreview'
export function SkillDetail({ id }: { id: string }) {
  const { request, workspaceId } = useWorkspaceApi()
  const skill = useQuery({
    queryKey: ['home-skill-detail', workspaceId, id],
    queryFn: async ({ signal }) =>
      skillVersionSchema.parse(
        await request(`skills/${encodeURIComponent(id)}`, undefined, 'GET', {
          signal,
        }),
      ),
    retry: false,
  })
  return skill.isPending ? (
    <LoadingState inset>Loading skill…</LoadingState>
  ) : skill.isError ? (
    <p role="alert">This skill could not be loaded.</p>
  ) : (
    <SkillPreview skill={skill.data} />
  )
}

export function AccountAssetDetail({
  kind,
  id,
}: {
  kind: 'job' | 'workflow-run' | 'integration' | 'mcp-server'
  id: string
}) {
  const { request, workspaceId } = useWorkspaceApi()
  const detail = useQuery({
    queryKey: ['home-account-detail', workspaceId, kind, id],
    queryFn: async () => {
      const path = `references/kody/inspect?${new URLSearchParams({ entity: `${kind}:${encodeURIComponent(id)}` })}`
      try {
        return kodyReferenceDetailSchema.parse(await request(path))
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 409) throw error
        await request('references/kody/refresh', {}, 'POST')
        return kodyReferenceDetailSchema.parse(await request(path))
      }
    },
    retry: false,
  })
  return detail.isPending ? (
    <LoadingState inset>Loading details…</LoadingState>
  ) : detail.isError ? (
    <p role="alert">Current details could not be loaded.</p>
  ) : detail.data.kind === 'account-object' ? (
    <dl>
      {detail.data.fields.map((field) => (
        <div key={field.label}>
          <dt>{field.label}</dt>
          <dd>{field.value}</dd>
        </div>
      ))}
    </dl>
  ) : null
}
