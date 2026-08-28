import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  CheckIcon,
  GithubLogoIcon,
  RocketIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import { seo } from '~/utils/seo'
import {
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogStatus,
  type DialogSize,
  type DialogStatusTone,
} from '~/components/ds/ui'
import { ComponentPreview, DsPage, DsSection } from '~/components/ds/DsKit'

export const Route = createFileRoute('/ds/dialog')({
  component: DialogPage,
  head: () => ({
    meta: seo({
      title: 'Dialog | TanStack Design System',
      description:
        'The centered modal dialog — Radix-backed, on the semantic token layer.',
    }),
  }),
})

const SIZES: Array<DialogSize> = ['xs', 'sm', 'md', 'lg', 'xl']

/** Which DS token supplies each attribute of the panel. */
const TOKEN_COVERAGE: Array<{
  attribute: string
  token: string
  status: 'existing' | 'added'
  note: string
}> = [
  {
    attribute: 'Panel surface',
    token: 'bg-background-elevated',
    status: 'existing',
    note: 'Highest of the three background tiers. Identical to `surface` in light mode; #2b2b2b in dark, where the shipping dialogs use the warm gray-900 (#201b15) off a different ramp.',
  },
  {
    attribute: 'Panel border',
    token: 'border-border-default',
    status: 'existing',
    note: 'Carries the edge in light mode, where all three background tiers are #ffffff and only shadow separates layers.',
  },
  {
    attribute: 'Elevation',
    token: 'shadow-2xl',
    status: 'existing',
    note: 'Already the de facto modal elevation; 4 of 6 centered dialogs use it (one outlier at shadow-xl).',
  },
  {
    attribute: 'Corner radius',
    token: 'rounded-xl corner-squircle',
    status: 'existing',
    note: 'rounded-xl is the audited majority. corner-squircle matches Card and Button.',
  },
  {
    attribute: 'Title / body text',
    token: 'text-text-primary, text-text-muted',
    status: 'existing',
    note: 'Replaces text-gray-900 dark:text-gray-100 at every call site.',
  },
  {
    attribute: 'Close affordance',
    token: 'text-icon-muted, hover:bg-surface-state-hover',
    status: 'existing',
    note: 'The interaction-state overlay tokens already exist and were unused by every dialog.',
  },
  {
    attribute: 'Focus ring',
    token: 'ring-border-focus',
    status: 'existing',
    note: 'focus-visible only, so the ring does not appear on mouse click.',
  },
  {
    attribute: 'Scrim',
    token: 'bg-scrim',
    status: 'added',
    note: 'Did not exist. Seven hand-picked black/NN values across the audit. Deliberately heavier in dark (0.65 vs 0.5) — equal alpha reads as weaker separation over an already-dark page.',
  },
  {
    attribute: 'Stacking tier',
    token: 'z-[var(--z-scrim)] / z-[var(--z-overlay)]',
    status: 'added',
    note: 'Did not exist. Five unrelated z-index families were in use. Values set to 999/1000 — the existing majority — so adopting them moves nothing.',
  },
  {
    attribute: 'Motion',
    token: 'animate-dialog-panel-in / -out',
    status: 'added',
    note: 'Keyframes are real. The animate-in / fade-in-0 / zoom-in-95 classes used elsewhere in the codebase come from tailwindcss-animate, which is not installed — they match zero CSS rules. Timing reuses --motion-duration-fast and --motion-ease-standard.',
  },
]

function DialogPage() {
  const [basic, setBasic] = React.useState(false)
  const [scrolling, setScrolling] = React.useState(false)
  const [destructive, setDestructive] = React.useState(false)
  const [size, setSize] = React.useState<DialogSize | null>(null)
  const [tinted, setTinted] = React.useState(false)
  const [statusTone, setStatusTone] = React.useState<DialogStatusTone | null>(
    null,
  )

  return (
    <DsPage
      title="Dialog"
      description="The centered modal. Always Radix-backed — focus trapping, focus restoration, Escape-to-dismiss and scroll lock come from the primitive, not from each call site. Composed from Dialog + DialogContent + DialogHeader / DialogBody / DialogFooter. Source: src/components/ds/ui/Dialog.tsx."
    >
      <DsSection
        title="Basic"
        description="Header, body and footer are separate parts so a dialog can omit any of them."
      >
        <ComponentPreview
          code={`<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent size="sm">
    <DialogHeader
      title="Sign in to continue"
      description="Choose a sign-in method."
    />
    <DialogBody>…</DialogBody>
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="secondary" size="sm">Cancel</Button>
      </DialogClose>
      <Button size="sm">Continue</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>`}
        >
          <Button variant="secondary" onClick={() => setBasic(true)}>
            Open dialog
          </Button>
          <Dialog open={basic} onOpenChange={setBasic}>
            <DialogContent size="sm">
              <DialogHeader
                title="Sign in to continue"
                description="Choose a sign-in method."
              />
              <DialogBody>
                <p className="text-sm text-text-secondary">
                  Body content sits in its own scroll region, so a long dialog
                  scrolls internally instead of pushing the footer off-screen.
                </p>
              </DialogBody>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="secondary" size="sm">
                    Cancel
                  </Button>
                </DialogClose>
                <Button size="sm">Continue</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Sizes"
        description="xs through xl. Every size keeps a 1rem viewport gutter, so the panel never touches the screen edge on mobile."
      >
        <ComponentPreview code={`<DialogContent size="md">…</DialogContent>`}>
          <div className="flex flex-wrap gap-2">
            {SIZES.map((s) => (
              <Button
                key={s}
                variant="secondary"
                size="sm"
                onClick={() => setSize(s)}
              >
                {s}
              </Button>
            ))}
          </div>
          <Dialog
            open={size !== null}
            onOpenChange={(open) => !open && setSize(null)}
          >
            <DialogContent size={size ?? 'sm'}>
              <DialogHeader title={`Size ${size ?? ''}`} />
              <DialogBody>
                <p className="text-sm text-text-secondary">
                  max-w-{size} with a calc(100vw - 2rem) floor.
                </p>
              </DialogBody>
              <DialogFooter>
                <DialogClose asChild>
                  <Button size="sm">Close</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Scrolling body"
        description="The panel caps at calc(100dvh - 2rem) and the body scrolls. None of the six centered dialogs on the site do this today — the 5-step deploy wizard simply overflows the viewport."
      >
        <ComponentPreview
          code={`<DialogContent size="md">
  <DialogHeader title="Terms" />
  <DialogBody>{/* long content */}</DialogBody>
  <DialogFooter>…</DialogFooter>
</DialogContent>`}
        >
          <Button variant="secondary" onClick={() => setScrolling(true)}>
            Open long dialog
          </Button>
          <Dialog open={scrolling} onOpenChange={setScrolling}>
            <DialogContent size="md">
              <DialogHeader
                title="Terms of service"
                description="Header and footer stay put; only the body moves."
              />
              <DialogBody>
                {Array.from({ length: 12 }).map((_, i) => (
                  <p key={i} className="mb-4 text-sm text-text-secondary">
                    Section {i + 1}. Long-form content demonstrating that the
                    body scrolls independently while the header and footer
                    remain pinned.
                  </p>
                ))}
              </DialogBody>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="secondary" size="sm">
                    Decline
                  </Button>
                </DialogClose>
                <Button size="sm">Accept</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Destructive confirm"
        description="Replaces the inline confirm in routes/admin/roles.$roleId.tsx, which had no focus trap, no Escape handler and no close button — a destructive action a keyboard user could not dismiss."
      >
        <ComponentPreview
          code={`<DialogContent size="sm">
  <DialogHeader title="Confirm removal" description="…" />
  <DialogFooter>
    <DialogClose asChild>
      <Button variant="secondary" size="sm">Cancel</Button>
    </DialogClose>
    <Button size="sm" color="red">Remove</Button>
  </DialogFooter>
</DialogContent>`}
        >
          <Button variant="secondary" onClick={() => setDestructive(true)}>
            Remove user
          </Button>
          <Dialog open={destructive} onOpenChange={setDestructive}>
            <DialogContent size="sm">
              <DialogHeader
                title="Confirm removal"
                description="Are you sure you want to remove this user from the role? This cannot be undone."
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="secondary" size="sm">
                    Cancel
                  </Button>
                </DialogClose>
                <Button size="sm" color="red">
                  Remove
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Tinted header"
        description="`media` puts a mark in a tile beside the title; `tint` colours that tile and washes the header behind it. It is a deliberate escape hatch from the token layer — these are third-party brand colours (Cloudflare orange, Netlify teal) that cannot be DS tokens because they are not ours. Everything else in the header stays on tokens."
      >
        <ComponentPreview
          code={`<DialogHeader
  title="Deploy to Cloudflare"
  description="start-basic"
  media={<RocketIcon className="w-5 h-5 text-white" />}
  tint="#F38020"
/>`}
        >
          <Button variant="secondary" onClick={() => setTinted(true)}>
            Open tinted dialog
          </Button>
          <Dialog open={tinted} onOpenChange={setTinted}>
            <DialogContent size="md">
              <DialogHeader
                title="Deploy to Cloudflare"
                description="start-basic"
                media={<RocketIcon className="w-5 h-5 text-white" />}
                tint="#F38020"
              />
              <DialogBody className="py-6">
                <p className="text-sm text-text-secondary">
                  A tinted header takes a rule and even padding, so it reads as
                  a banded region rather than bleeding into the body.
                </p>
              </DialogBody>
            </DialogContent>
          </Dialog>
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Status panel"
        description="`DialogStatus` is the mark / heading / description / actions layout that every non-form step of the deploy dialogs already used. Five hand-built copies, each picking its own raw red or green Tailwind pair; tones now map onto the status-* tokens. Errors carry a role of alert and the loading tone is aria-live, so an outcome that only changes pixels is still announced."
      >
        <ComponentPreview
          code={`<DialogStatus
  tone="success"
  icon={<CheckIcon />}
  title="Repository Created!"
  description="Your repo is ready."
  actions={<Button size="sm">Deploy Now</Button>}
/>`}
        >
          <div className="flex flex-wrap gap-2">
            {(['loading', 'neutral', 'success', 'error'] as const).map((t) => (
              <Button
                key={t}
                variant="secondary"
                size="sm"
                onClick={() => setStatusTone(t)}
              >
                {t}
              </Button>
            ))}
          </div>
          <Dialog
            open={statusTone !== null}
            onOpenChange={(open) => !open && setStatusTone(null)}
          >
            <DialogContent size="md">
              <DialogHeader title="Deploy" />
              <DialogBody className="py-6">
                {statusTone === 'loading' ? (
                  <DialogStatus
                    tone="loading"
                    description="Creating repository..."
                  />
                ) : statusTone === 'neutral' ? (
                  <DialogStatus
                    tone="neutral"
                    icon={<GithubLogoIcon />}
                    title="GitHub Authorization Required"
                    description="We need permission to create a repository on your account."
                    actions={<Button size="sm">Connect GitHub</Button>}
                  />
                ) : statusTone === 'success' ? (
                  <DialogStatus
                    tone="success"
                    icon={<CheckIcon />}
                    title="Repository Created!"
                    description="tanstack/start-basic"
                    actions={<Button size="sm">Deploy Now</Button>}
                  />
                ) : statusTone === 'error' ? (
                  <DialogStatus
                    tone="error"
                    icon={<WarningCircleIcon />}
                    title="Deployment Failed"
                    description="The repository name is already taken."
                    actions={
                      <>
                        <Button variant="secondary" size="sm">
                          Cancel
                        </Button>
                        <Button size="sm">Try Again</Button>
                      </>
                    }
                  />
                ) : null}
              </DialogBody>
            </DialogContent>
          </Dialog>
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Token coverage"
        description="Every visual attribute of the panel, and the DS token that supplies it. Three tokens did not exist before this component and were added to app.css."
      >
        <div className="overflow-x-auto rounded-xl border border-border-default">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="border-b border-border-default bg-background-subtle">
              <tr className="text-xs uppercase tracking-wide text-text-muted">
                <th className="px-3 py-2 font-semibold">Attribute</th>
                <th className="px-3 py-2 font-semibold">Token</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {TOKEN_COVERAGE.map((row) => (
                <tr key={row.attribute} className="align-top">
                  <td className="px-3 py-2 font-medium text-text-primary">
                    {row.attribute}
                  </td>
                  <td className="px-3 py-2">
                    <code className="font-mono text-xs text-text-secondary">
                      {row.token}
                    </code>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        row.status === 'added'
                          ? 'rounded bg-status-warning-bg px-1.5 py-0.5 text-xs font-medium text-status-warning'
                          : 'text-xs text-text-muted'
                      }
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DsSection>

      <DsSection
        title="Behaviour from Radix"
        description="Not configurable, by design. Every accessibility failure in the overlay audit came from a hand-rolled dialog missing one of these."
      >
        <ul className="flex flex-col gap-2 text-sm text-text-secondary">
          {[
            'Focus moves into the panel on open and returns to the trigger on close.',
            'Tab and Shift+Tab are trapped inside the panel.',
            'Escape dismisses. Clicking the scrim dismisses.',
            'Body scroll is locked while open.',
            'aria-modal, role="dialog", and the title/description associations are wired automatically.',
            'prefers-reduced-motion removes the animation but keeps the state change.',
          ].map((line) => (
            <li key={line} className="flex gap-2">
              <span className="mt-[9px] size-1 shrink-0 rounded-full bg-text-muted" />
              {line}
            </li>
          ))}
        </ul>
      </DsSection>
    </DsPage>
  )
}
