import { LoadingState } from './ui/LoadingState'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { kodyReferenceDetailSchema } from '../core/kody-reference-detail'
import {
  kodyPackageDocumentSchema,
  type KodyPackageDocumentKind,
} from '../core/kody-package-document'
import type { KodyAccount } from '../core/kody-account'
import { ApiError, useWorkspaceApi } from './WorkspaceApi'
import { MessageMarkdown } from './MessageMarkdown'

type Package = KodyAccount['packages']['items'][number]

function PackageDocument({
  accountScope,
  item,
  kind,
  label,
  initiallyOpen = false,
}: {
  accountScope: string
  item: Package
  kind: KodyPackageDocumentKind
  label: string
  initiallyOpen?: boolean
}) {
  const { request, workspaceId } = useWorkspaceApi()
  const [open, setOpen] = useState(initiallyOpen)
  const document = useQuery({
    queryKey: [
      'kody-package-document',
      workspaceId,
      accountScope,
      item.id,
      item.revision,
      item.updatedAt,
      kind,
    ],
    enabled: open,
    queryFn: async ({ signal }) =>
      kodyPackageDocumentSchema.parse(
        await request(
          `kody/packages/${encodeURIComponent(item.id)}/document?kind=${kind}`,
          undefined,
          'GET',
          { signal },
        ),
      ),
    staleTime: 30_000,
    refetchOnMount: true,
    retry: false,
  })
  const current = !document.isError ? document.data : undefined
  const Container = initiallyOpen ? 'section' : 'details'
  return (
    <Container
      className="connection-kody-export"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      {!initiallyOpen && <summary>{label}</summary>}
      {open && (
        <div className="connection-kody-document">
          {!document.isError && !current && <LoadingState inset />}
          {document.isError && <p role="alert">{document.error.message}</p>}
          {current && (
            <>
              <MessageMarkdown httpsLinksOnly>
                {current.content}
              </MessageMarkdown>
              {current.excerpted && <p>Only part of this document is shown.</p>}
            </>
          )}
        </div>
      )}
    </Container>
  )
}

function usePackageDetail(
  accountScope: string,
  item: Package,
  subpath: string | undefined,
  open: boolean,
) {
  const { request, workspaceId } = useWorkspaceApi()
  const entity = `package:${item.id}${subpath === undefined ? '' : `#${subpath}`}`
  return useQuery({
    queryKey: [
      'kody-saved-package-detail',
      workspaceId,
      accountScope,
      item.id,
      item.revision,
      item.updatedAt,
      subpath,
    ],
    enabled: open,
    queryFn: async () => {
      const path = `references/kody/inspect?${new URLSearchParams({ entity })}`
      try {
        return kodyReferenceDetailSchema.parse(await request(path))
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 409) throw error
        await request('references/kody/refresh', {}, 'POST')
        return kodyReferenceDetailSchema.parse(await request(path))
      }
    },
    staleTime: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: false,
  })
}

function PackageExport({
  accountScope,
  item,
  subpath,
  description,
}: {
  accountScope: string
  item: Package
  subpath: string
  description: string
}) {
  const [open, setOpen] = useState(false)
  const detail = usePackageDetail(accountScope, item, subpath, open)
  const current = !detail.isError ? detail.data : undefined
  const label = subpath === '.' ? 'Overview' : subpath.replace(/^\.\//, '')
  return (
    <details
      className="connection-kody-export"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <strong>{label}</strong>
        {description && (
          <span className="package-action-description">{description}</span>
        )}
      </summary>
      {open && (
        <div>
          {detail.isError && <p role="alert">{detail.error.message}</p>}
          {!detail.isError && !current && <LoadingState inset />}
          {current?.kind === 'package' && (
            <>
              {!description && current.description && (
                <p>{current.description}</p>
              )}
              {(current.importSpecifier || current.typeDefinition) && (
                <div className="package-technical">
                  {current.importSpecifier && (
                    <p>
                      Import <code>{current.importSpecifier}</code>
                    </p>
                  )}
                  {current.typeDefinition && (
                    <pre>{current.typeDefinition}</pre>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </details>
  )
}

function SavedPackage({
  accountScope,
  item,
  initiallyOpen = false,
}: {
  accountScope: string
  item: Package
  initiallyOpen?: boolean
}) {
  const [open, setOpen] = useState(initiallyOpen)
  const detail = usePackageDetail(accountScope, item, undefined, open)
  const current = !detail.isError ? detail.data : undefined
  const Container = initiallyOpen ? 'section' : 'details'
  return (
    <Container
      className="connection-kody-package"
      {...(!initiallyOpen
        ? {
            open,
            onToggle: (event: React.SyntheticEvent<HTMLDetailsElement>) =>
              setOpen(event.currentTarget.open),
          }
        : {})}
    >
      {!initiallyOpen && (
        <summary>
          <strong>{item.name}</strong>
          {item.sourceListing && <span>From {item.sourceListing}</span>}
        </summary>
      )}
      {open && (
        <div className="connection-kody-package-body">
          {item.lockedAt && <p>Publishing requires your approval in Kody.</p>}
          {item.upstreamAhead && <p>A newer community version is available.</p>}
          {item.sourceListing && (
            <dl>
              <div>
                <dt>Forked from</dt>
                <dd>{item.sourceListing}</dd>
              </div>
              {item.revision && (
                <div>
                  <dt>Last absorbed community revision</dt>
                  <dd>
                    <code>{item.revision}</code>
                  </dd>
                </div>
              )}
              {item.upstreamRevision && (
                <div>
                  <dt>Current community revision</dt>
                  <dd>
                    <code>{item.upstreamRevision}</code>
                  </dd>
                </div>
              )}
            </dl>
          )}
          {/^@[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(item.name) && (
            <div className="home-page-actions">
              <a
                href={`https://kody.codes/${item.name}/tree/main`}
                target="_blank"
                rel="noreferrer"
              >
                Source files
              </a>
              <a
                href={`https://kody.codes/${item.name}/settings`}
                target="_blank"
                rel="noreferrer"
              >
                Package settings{item.hasApp ? ' and app' : ''}
              </a>
            </div>
          )}
          {detail.isError && <p role="alert">{detail.error.message}</p>}
          {!detail.isError && !current && <LoadingState inset />}
          {current?.kind === 'package' && (
            <>
              {current.intent ? (
                <MessageMarkdown httpsLinksOnly>
                  {current.intent}
                </MessageMarkdown>
              ) : (
                current.description && <p>{current.description}</p>
              )}
              {current.documents?.readme && (
                <PackageDocument
                  accountScope={accountScope}
                  item={item}
                  kind="readme"
                  label="About and setup"
                  initiallyOpen={initiallyOpen}
                />
              )}
              {current.documents?.agents && (
                <PackageDocument
                  accountScope={accountScope}
                  item={item}
                  kind="agents"
                  label="Agent instructions"
                />
              )}
              {!!current.exports?.length && (
                <div className="connection-kody-package-exports">
                  <strong>Actions and modules</strong>
                  {current.exports.map((entry) => (
                    <PackageExport
                      key={entry.subpath}
                      accountScope={accountScope}
                      item={item}
                      subpath={entry.subpath}
                      description={entry.description}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Container>
  )
}

export function KodySavedPackages({
  accountScope,
  items,
  limited,
  initiallyOpen = false,
}: {
  accountScope: string
  items: Package[]
  limited: boolean
  initiallyOpen?: boolean
}) {
  if (items.length === 0) return null
  if (initiallyOpen)
    return (
      <>
        {items.map((item) => (
          <SavedPackage
            key={item.id}
            accountScope={accountScope}
            item={item}
            initiallyOpen
          />
        ))}
      </>
    )
  return (
    <details
      className="connection-kody-section"
      open={initiallyOpen || undefined}
    >
      <summary>
        Saved packages ({items.length}
        {limited ? '+' : ''})
      </summary>
      {items.map((item) => (
        <SavedPackage
          key={item.id}
          accountScope={accountScope}
          item={item}
          initiallyOpen={initiallyOpen}
        />
      ))}
    </details>
  )
}
