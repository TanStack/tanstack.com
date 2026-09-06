import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { CheckIcon, XIcon } from '@phosphor-icons/react'
import shopCss from '~/styles/shop.css?url'
import { seo } from '~/utils/seo'
import { Button } from '~/components/ds/ui'
import { DsPage, DsSection } from '~/components/ds/DsKit'
import {
  AvatarCropModalSpecimen,
  BuilderGuideDialogSpecimen,
  CartDrawerSpecimen,
  ExampleDeployDialogSpecimen,
  LibrariesOverlaySpecimen,
  LoginModalSpecimen,
  NpmStatsDialogSpecimen,
  ProductDrawerSpecimen,
  RolesConfirmDialogSpecimen,
  SearchModalSpecimen,
  StarterDeployDialogSpecimen,
} from '~/components/ds/overlay-audit'
import {
  DIVERGENCE,
  SPECIMENS,
  type SpecimenMeta,
} from '~/components/ds/overlay-audit/specimen-meta'

export const Route = createFileRoute('/ds/overlays')({
  component: OverlayAuditPage,
  // The two shop specimens depend on tokens defined in shop.css, which is
  // otherwise only loaded under /shop. Linking it here is itself an audit
  // finding: two of eleven overlays cannot render outside their own route.
  head: () => ({
    links: [{ rel: 'stylesheet', href: shopCss }],
    meta: seo({
      title: 'Overlay Audit | TanStack Design System',
      description:
        'Every dialog, drawer and overlay shipping on the site, pulled into one page for side-by-side review.',
    }),
  }),
})

const SPECIMEN_COMPONENTS: Record<
  string,
  React.ComponentType<{ open: boolean; onOpenChange: (o: boolean) => void }>
> = {
  login: LoginModalSpecimen,
  'avatar-crop': AvatarCropModalSpecimen,
  'npm-stats': NpmStatsDialogSpecimen,
  'roles-confirm': RolesConfirmDialogSpecimen,
  'example-deploy': ExampleDeployDialogSpecimen,
  'starter-deploy': StarterDeployDialogSpecimen,
  'builder-guide': BuilderGuideDialogSpecimen,
  'cart-drawer': CartDrawerSpecimen,
  'product-drawer': ProductDrawerSpecimen,
  'libraries-overlay': LibrariesOverlaySpecimen,
  'search-modal': SearchModalSpecimen,
}

const POSTURE_ORDER: Array<SpecimenMeta['posture']> = [
  'centered',
  'edge-sheet',
  'anchored-panel',
  'bottom-sheet',
  'top-anchored',
  'full-bleed',
]

const POSTURE_LABEL: Record<SpecimenMeta['posture'], string> = {
  centered: 'Centered',
  'edge-sheet': 'Edge sheet',
  'anchored-panel': 'Anchored panel',
  'bottom-sheet': 'Bottom sheet',
  'top-anchored': 'Top anchored',
  'full-bleed': 'Full bleed',
}

function OverlayAuditPage() {
  const [openId, setOpenId] = React.useState<string | null>(null)

  return (
    <DsPage
      title="Overlay Audit"
      description="Every dialog, drawer and overlay currently shipping on the site, copied verbatim into isolated specimens so they can be compared side by side. This page is scaffolding for designing the DS overlay primitive — it is not itself part of the system, and nothing here should be imported outside /ds."
    >
      <DsSection
        title="Launch"
        description="Open each specimen against the same background. Grouped by positional posture — the axis that actually needs to become a prop."
      >
        <div className="flex flex-col gap-6">
          {POSTURE_ORDER.map((posture) => {
            const group = SPECIMENS.filter((s) => s.posture === posture)
            if (!group.length) return null
            return (
              <div key={posture}>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {POSTURE_LABEL[posture]}
                  <span className="ml-2 font-normal normal-case tracking-normal">
                    {group.length} {group.length === 1 ? 'variant' : 'variants'}
                  </span>
                </h4>
                <div className="flex flex-wrap gap-2">
                  {group.map((s) => (
                    <Button
                      key={s.id}
                      variant={s.base === 'hand-rolled' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setOpenId(s.id)}
                    >
                      {s.name}
                      {s.base === 'hand-rolled' ? (
                        <span
                          title="Hand-rolled — no Radix"
                          className="ml-1.5 rounded bg-status-warning/15 px-1 py-0.5 text-[10px] font-medium text-status-warning"
                        >
                          raw
                        </span>
                      ) : null}
                    </Button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </DsSection>

      <DsSection
        title="Property matrix"
        description="Read off the source, not inferred. The four columns on the right are what Radix gives you for free — every ✗ is a hand-rolled dialog missing a behaviour it should never have had to implement."
      >
        <div className="overflow-x-auto rounded-xl border border-border-default">
          <table className="w-full min-w-[64rem] text-left text-sm">
            <thead className="border-b border-border-default bg-background-subtle">
              <tr className="text-xs uppercase tracking-wide text-text-muted">
                <th className="px-3 py-2 font-semibold">Specimen</th>
                <th className="px-3 py-2 font-semibold">Posture</th>
                <th className="px-3 py-2 font-semibold">Base</th>
                <th className="px-3 py-2 font-semibold">Tokens</th>
                <th className="px-3 py-2 font-semibold">z-index</th>
                <th className="px-3 py-2 font-semibold">Scrim</th>
                <th className="px-3 py-2 text-center font-semibold">Trap</th>
                <th className="px-3 py-2 text-center font-semibold">Restore</th>
                <th className="px-3 py-2 text-center font-semibold">Esc</th>
                <th className="px-3 py-2 text-center font-semibold">Lock</th>
                <th className="px-3 py-2 text-center font-semibold">Anim</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {SPECIMENS.map((s) => (
                <tr key={s.id} className="align-top">
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setOpenId(s.id)}
                      className="text-left font-medium text-text-primary underline decoration-dotted underline-offset-2 hover:text-text-secondary"
                    >
                      {s.name}
                    </button>
                    <p className="mt-0.5 font-mono text-[11px] text-text-muted">
                      {s.source.replace('src/', '')} · {s.sourceLines} lines
                    </p>
                  </td>
                  <td className="px-3 py-2 text-text-secondary">
                    {POSTURE_LABEL[s.posture]}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        s.base === 'hand-rolled'
                          ? 'font-medium text-status-warning'
                          : 'text-text-secondary'
                      }
                    >
                      {s.base}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        s.tokens === 'semantic'
                          ? 'font-medium text-status-success'
                          : 'text-text-secondary'
                      }
                    >
                      {s.tokens}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-text-secondary">
                    {s.zIndex}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-text-secondary">
                    {s.overlay}
                  </td>
                  <BoolCell value={s.focusTrap} />
                  <BoolCell value={s.focusRestore} />
                  <BoolCell value={s.escape} />
                  <BoolCell value={s.scrollLock} />
                  <BoolCell value={s.animated} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DsSection>

      <DsSection
        title="Divergence"
        description="Where the eleven specimens disagree. Each row is a decision the primitive has to make once, so eleven call sites stop making it independently."
      >
        <div className="flex flex-col gap-3">
          {DIVERGENCE.map((d) => (
            <div
              key={d.property}
              className="rounded-xl border border-border-default bg-background-surface p-4"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h4 className="font-medium text-text-primary">{d.property}</h4>
                <span className="text-xs text-text-muted">
                  {d.values.length} distinct values
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {d.values.map((v) => (
                  <code
                    key={v}
                    className="rounded bg-background-subtle px-1.5 py-0.5 font-mono text-[11px] text-text-secondary"
                  >
                    {v}
                  </code>
                ))}
              </div>
              <p className="mt-2 text-sm text-text-secondary">{d.verdict}</p>
            </div>
          ))}
        </div>
      </DsSection>

      <DsSection
        title="Notes per specimen"
        description="What each one contributes to the primitive's requirements."
      >
        <dl className="flex flex-col gap-3">
          {SPECIMENS.map((s) => (
            <div
              key={s.id}
              className="rounded-lg border border-border-default px-4 py-3"
            >
              <dt className="font-medium text-text-primary">{s.name}</dt>
              <dd className="mt-1 text-sm text-text-secondary">{s.notes}</dd>
            </div>
          ))}
        </dl>
      </DsSection>

      {SPECIMENS.map((s) => {
        const Component = SPECIMEN_COMPONENTS[s.id]
        if (!Component) return null
        return (
          <Component
            key={s.id}
            open={openId === s.id}
            onOpenChange={(next) => setOpenId(next ? s.id : null)}
          />
        )
      })}
    </DsPage>
  )
}

function BoolCell({ value }: { value: boolean }) {
  return (
    <td className="px-3 py-2 text-center">
      {value ? (
        <CheckIcon
          className="inline size-4 text-status-success"
          aria-label="yes"
        />
      ) : (
        <XIcon className="inline size-4 text-status-error" aria-label="no" />
      )}
    </td>
  )
}
