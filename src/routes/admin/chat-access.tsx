import { createFileRoute } from '@tanstack/react-router'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useState } from 'react'
import { ChatsCircleIcon } from '@phosphor-icons/react'
import {
  createAdminChatInvite,
  expireChatInvite,
  grantChatAccess,
  listChatInvites,
  listChatWaitlist,
} from '~/chat/access-admin.functions'
import { useAdminGuard } from '~/hooks/useAdminGuard'
import {
  AdminAccessDenied,
  AdminLoading,
  AdminPageHeader,
} from '~/components/admin'
import {
  Table,
  TableHeader,
  TableHeaderRow,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from '~/components/TableComponents'
import { Button } from '~/ui'

export const Route = createFileRoute('/admin/chat-access')({
  component: ChatAccessAdminPage,
})

export function ChatAccessAdminPage() {
  const guard = useAdminGuard()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'waitlist' | 'invites'>('waitlist')
  const [page, setPage] = useState(0)
  const [waitlistStatus, setWaitlistStatus] = useState<
    'waiting' | 'granted' | 'all'
  >('waiting')
  const [inviteStatus, setInviteStatus] = useState<
    'pending' | 'redeemed' | 'expired' | 'all'
  >('pending')
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState('')
  const waitlistQuery = useQuery({
    queryKey: ['admin', 'chat-access', 'waitlist', page, waitlistStatus],
    queryFn: () => listChatWaitlist({ data: { page, status: waitlistStatus } }),
    enabled: guard.status === 'authorized' && tab === 'waitlist',
    placeholderData: keepPreviousData,
  })
  const invitesQuery = useQuery({
    queryKey: ['admin', 'chat-access', 'invites', page, inviteStatus],
    queryFn: () => listChatInvites({ data: { page, status: inviteStatus } }),
    enabled: guard.status === 'authorized' && tab === 'invites',
    placeholderData: keepPreviousData,
  })
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'chat-access'] })
  const grantMutation = useMutation({
    mutationFn: (userId: string) => grantChatAccess({ data: { userId } }),
    onSuccess: refresh,
  })
  const expireMutation = useMutation({
    mutationFn: (tokenHash: string) =>
      expireChatInvite({ data: { tokenHash } }),
    onSuccess: refresh,
  })
  const createMutation = useMutation({
    mutationFn: () => createAdminChatInvite(),
    onSuccess: async ({ token }) => {
      setInviteLink(
        `${window.location.origin}/chat-access?invite=${encodeURIComponent(token)}`,
      )
      setCopied(false)
      setCopyError('')
      await refresh()
    },
  })

  if (guard.status === 'loading') return <AdminLoading />
  if (guard.status === 'denied') return <AdminAccessDenied />

  const query = tab === 'waitlist' ? waitlistQuery : invitesQuery
  const error =
    query.error ??
    grantMutation.error ??
    expireMutation.error ??
    createMutation.error
  const invitesData = invitesQuery.data
  const data = query.data
  const total = data?.total ?? 0
  const pageSize = data?.pageSize ?? 25
  const empty = data?.entries.length === 0
  const inputClass =
    'rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-black/30 px-3 py-2 text-sm'

  return (
    <div className="w-full p-4">
      <div className="mx-auto max-w-7xl space-y-6">
        <AdminPageHeader
          icon={<ChatsCircleIcon />}
          title="TanChat Access"
          isLoading={query.isFetching}
          actions={
            <Button
              variant="ghost"
              onClick={() => void refresh()}
              disabled={query.isFetching}
            >
              Refresh
            </Button>
          }
        />
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-2" aria-label="Access lists">
            <Button
              variant={tab === 'waitlist' ? 'primary' : 'ghost'}
              aria-pressed={tab === 'waitlist'}
              onClick={() => {
                setTab('waitlist')
                setPage(0)
              }}
            >
              Waitlist
            </Button>
            <Button
              variant={tab === 'invites' ? 'primary' : 'ghost'}
              aria-pressed={tab === 'invites'}
              onClick={() => {
                setTab('invites')
                setPage(0)
              }}
            >
              Invites
            </Button>
          </div>
          {tab === 'waitlist' ? (
            <label className="flex items-center gap-2 text-sm">
              Status
              <select
                className={inputClass}
                value={waitlistStatus}
                onChange={(event) => {
                  const value = event.target.value
                  if (
                    value === 'waiting' ||
                    value === 'granted' ||
                    value === 'all'
                  ) {
                    setWaitlistStatus(value)
                    setPage(0)
                  }
                }}
              >
                <option value="waiting">Waiting</option>
                <option value="granted">Granted</option>
                <option value="all">All</option>
              </select>
            </label>
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm">
                Status
                <select
                  className={inputClass}
                  value={inviteStatus}
                  onChange={(event) => {
                    const value = event.target.value
                    if (
                      value === 'pending' ||
                      value === 'redeemed' ||
                      value === 'expired' ||
                      value === 'all'
                    ) {
                      setInviteStatus(value)
                      setPage(0)
                    }
                  }}
                >
                  <option value="pending">Pending</option>
                  <option value="redeemed">Redeemed</option>
                  <option value="expired">Expired</option>
                  <option value="all">All</option>
                </select>
              </label>
              <Button
                className="ml-auto"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating…' : 'Create invite'}
              </Button>
            </>
          )}
        </div>
        {inviteLink && (
          <div className="space-y-2">
            <label
              htmlFor="admin-chat-invite"
              className="block text-sm font-medium"
            >
              New invite link, works once and expires in seven days
            </label>
            <div className="flex gap-2">
              <input
                id="admin-chat-invite"
                className={`${inputClass} min-w-0 flex-1`}
                value={inviteLink}
                readOnly
                onFocus={(event) => event.target.select()}
              />
              <Button
                variant="ghost"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(inviteLink)
                    setCopied(true)
                    setCopyError('')
                  } catch {
                    setCopyError(
                      'Could not copy the link. Select it and copy it manually.',
                    )
                  }
                }}
              >
                {copied ? 'Copied' : 'Copy link'}
              </Button>
            </div>
            <p className="text-sm text-gray-500">
              Save this link before leaving. Existing invite links cannot be
              recovered.
            </p>
            {copyError && (
              <p role="alert" className="text-sm text-red-600">
                {copyError}
              </p>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="text-red-600">
            {error.message}
          </p>
        )}
        {tab === 'waitlist' && (
          <p className="text-sm text-gray-500">
            Grants shown here exclude automatic access for admins and
            maintainers.
          </p>
        )}
        {query.isPending ? (
          <AdminLoading />
        ) : empty ? (
          <p className="py-10 text-center text-gray-500">
            {tab === 'waitlist'
              ? 'No waitlist entries match this status.'
              : 'No invites match this status.'}
          </p>
        ) : tab === 'waitlist' ? (
          <Table>
            <TableHeader className="table-header-group!">
              <TableHeaderRow>
                <TableHeaderCell>User</TableHeaderCell>
                <TableHeaderCell>Joined</TableHeaderCell>
                <TableHeaderCell>Access granted</TableHeaderCell>
                <TableHeaderCell>Action</TableHeaderCell>
              </TableHeaderRow>
            </TableHeader>
            <TableBody>
              {waitlistQuery.data?.entries.map((entry) => (
                <TableRow key={entry.userId}>
                  <TableCell>
                    {entry.name && <div>{entry.name}</div>}
                    <a
                      className="text-blue-600 hover:underline"
                      href={`/admin/users/${entry.userId}`}
                    >
                      {entry.email}
                    </a>
                  </TableCell>
                  <TableCell>{entry.joinedAt.toLocaleString()}</TableCell>
                  <TableCell>
                    {entry.grantedAt?.toLocaleString() ?? 'Waiting'}
                  </TableCell>
                  <TableCell>
                    {!entry.grantedAt && (
                      <Button
                        size="sm"
                        disabled={
                          grantMutation.isPending || query.isPlaceholderData
                        }
                        onClick={() => grantMutation.mutate(entry.userId)}
                      >
                        {grantMutation.isPending &&
                        grantMutation.variables === entry.userId
                          ? 'Granting…'
                          : 'Grant access'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader className="table-header-group!">
              <TableHeaderRow>
                <TableHeaderCell>Created by</TableHeaderCell>
                <TableHeaderCell>Created</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Recipient</TableHeaderCell>
                <TableHeaderCell>Expires</TableHeaderCell>
                <TableHeaderCell>Action</TableHeaderCell>
              </TableHeaderRow>
            </TableHeader>
            <TableBody>
              {invitesData &&
                invitesData.entries.map((entry) => {
                  const pending =
                    !entry.redeemedAt &&
                    entry.expiresAt.getTime() > invitesData.serverTime.getTime()
                  return (
                    <TableRow key={entry.tokenHash}>
                      <TableCell>{entry.createdBy}</TableCell>
                      <TableCell>{entry.createdAt.toLocaleString()}</TableCell>
                      <TableCell>
                        {entry.redeemedAt
                          ? `Redeemed ${entry.redeemedAt.toLocaleString()}`
                          : pending
                            ? 'Pending'
                            : 'Expired'}
                      </TableCell>
                      <TableCell>{entry.redeemedBy ?? 'None'}</TableCell>
                      <TableCell>{entry.expiresAt.toLocaleString()}</TableCell>
                      <TableCell>
                        {pending && (
                          <Button
                            size="sm"
                            variant="ghost"
                            color="red"
                            disabled={
                              expireMutation.isPending ||
                              query.isPlaceholderData
                            }
                            onClick={() =>
                              expireMutation.mutate(entry.tokenHash)
                            }
                          >
                            {expireMutation.isPending &&
                            expireMutation.variables === entry.tokenHash
                              ? 'Expiring…'
                              : 'Expire invite'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
        )}
        <nav
          className="flex items-center justify-between gap-3 text-sm"
          aria-label="TanChat access pagination"
        >
          <span>
            {total} {tab === 'waitlist' ? 'people' : 'invites'}, page {page + 1}{' '}
            of {Math.max(1, Math.ceil(total / pageSize))}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              disabled={page === 0 || query.isFetching}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              disabled={(page + 1) * pageSize >= total || query.isFetching}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </nav>
      </div>
    </div>
  )
}
