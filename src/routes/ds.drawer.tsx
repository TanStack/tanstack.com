import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowSquareOutIcon } from '@phosphor-icons/react'
import { seo } from '~/utils/seo'
import {
  Button,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  type DrawerAnchor,
  type DrawerSide,
  type DrawerSize,
} from '~/components/ds/ui'
import { ComponentPreview, DsPage, DsSection } from '~/components/ds/DsKit'

export const Route = createFileRoute('/ds/drawer')({
  component: DrawerPage,
  head: () => ({
    meta: seo({
      title: 'Drawer | TanStack Design System',
      description:
        'The edge-anchored panel — right, left and bottom, on one Radix foundation.',
    }),
  }),
})

const SIDES: Array<DrawerSide> = ['right', 'left', 'bottom']
const SIZES: Array<DrawerSize> = ['sm', 'md', 'lg', 'xl', '2xl']

function DrawerPage() {
  const [side, setSide] = React.useState<DrawerSide | null>(null)
  const [size, setSize] = React.useState<DrawerSize | null>(null)
  const [guide, setGuide] = React.useState(false)
  const [footer, setFooter] = React.useState(false)
  const [fitDemo, setFitDemo] = React.useState<'full' | 'fit' | null>(null)
  const [anchorDemo, setAnchorDemo] = React.useState<DrawerAnchor | null>(null)

  return (
    <DsPage
      title="Drawer"
      description="The edge-anchored panel, also called a side sheet. Same Radix foundation and three-region layout as Dialog, anchored to an edge instead of centred. Right, left and bottom are one component because they are one mechanism — a surface arriving from off-screen — differing only in axis. Source: src/components/ds/ui/Drawer.tsx."
    >
      <DsSection
        title="Sides"
        description="Right and left become near-full-screen below the sm breakpoint: a 24rem side panel on a 375px screen is not a side panel. Bottom keeps its posture at every width."
      >
        <ComponentPreview
          code={`<Drawer open={open} onOpenChange={setOpen}>
  <DrawerContent side="right" size="md">
    <DrawerHeader title="Details" />
    <DrawerBody>…</DrawerBody>
  </DrawerContent>
</Drawer>`}
        >
          <div className="flex flex-wrap gap-2">
            {SIDES.map((s) => (
              <Button
                key={s}
                variant="secondary"
                size="sm"
                onClick={() => setSide(s)}
              >
                {s}
              </Button>
            ))}
          </div>
          <Drawer
            open={side !== null}
            onOpenChange={(open) => !open && setSide(null)}
          >
            <DrawerContent side={side ?? 'right'} size="md">
              <DrawerHeader
                title={`side="${side ?? ''}"`}
                description="Slides in from its anchored edge."
              />
              <DrawerBody>
                <p className="text-sm text-text-secondary">
                  The panel slides without fading. A sheet reads as a physical
                  surface arriving from off-screen; fading it at the same time
                  makes it read as a dissolve instead. Only the scrim fades.
                </p>
              </DrawerBody>
            </DrawerContent>
          </Drawer>
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Sizes"
        description="For right and left, size sets the width. For bottom it sets the height, since that is the axis the panel travels along."
      >
        <ComponentPreview
          code={`<DrawerContent side="right" size="2xl">…</DrawerContent>`}
        >
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
          <Drawer
            open={size !== null}
            onOpenChange={(open) => !open && setSize(null)}
          >
            <DrawerContent side="right" size={size ?? 'md'}>
              <DrawerHeader title={`size="${size ?? ''}"`} />
              <DrawerBody>
                <p className="text-sm text-text-secondary">
                  sm through 2xl. 2xl matches the width the charts builder guide
                  uses today.
                </p>
              </DrawerBody>
            </DrawerContent>
          </Drawer>
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Fit to content"
        description="By default a right or left drawer fills its edge. `fit` sizes it to its content and caps it at the viewport instead — the posture the shipping CartDrawer uses. DrawerBody is `flex: 1 1 auto`, so it grows to fill a full-height panel and hugs its content in a fit one without either call site configuring anything."
      >
        <ComponentPreview
          code={`{/* fills the edge — footer pinned to the bottom */}
<DrawerContent side="right" size="sm">…</DrawerContent>

{/* hugs its content — footer sits under the last item */}
<DrawerContent side="right" size="sm" fit>…</DrawerContent>`}
        >
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setFitDemo('full')}
            >
              Full height
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setFitDemo('fit')}
            >
              Fit to content
            </Button>
          </div>
          <Drawer
            open={fitDemo !== null}
            onOpenChange={(open) => !open && setFitDemo(null)}
          >
            <DrawerContent side="right" size="sm" fit={fitDemo === 'fit'}>
              <DrawerHeader
                title={fitDemo === 'fit' ? 'fit' : 'full height (default)'}
              />
              <DrawerBody>
                <p className="text-sm text-text-secondary">
                  Short content. Compare where the footer lands.
                </p>
              </DrawerBody>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button size="md">Primary action</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Anchor"
        description="Where a right or left panel's top edge sits. `viewport` uses the window's top gutter; `navbar` clears the site header so the panel reads as belonging to the chrome that opened it. This is the audit's sixth posture — the shipping CartDrawer was a separate implementation only because its top offset had nowhere to live. The offset reads --navbar-height with the same 56px fallback the navbar uses, so the panel stays correct if the header resizes."
      >
        <ComponentPreview
          code={`{/* sits in the window's top gutter */}
<DrawerContent side="right" size="sm" fit>…</DrawerContent>

{/* clears the site header */}
<DrawerContent side="right" size="sm" fit anchor="navbar">…</DrawerContent>`}
        >
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAnchorDemo('viewport')}
            >
              viewport
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAnchorDemo('navbar')}
            >
              navbar
            </Button>
          </div>
          <Drawer
            open={anchorDemo !== null}
            onOpenChange={(open) => !open && setAnchorDemo(null)}
          >
            <DrawerContent
              side="right"
              size="sm"
              fit
              anchor={anchorDemo ?? 'viewport'}
            >
              <DrawerHeader title={`anchor="${anchorDemo ?? ''}"`} />
              <DrawerBody>
                <p className="text-sm text-text-secondary">
                  Scroll up to the header and compare where the panel's top edge
                  lands. `navbar` also shortens the height cap by the same
                  amount, so a `fit` panel still never runs off the bottom.
                </p>
              </DrawerBody>
            </DrawerContent>
          </Drawer>
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Header actions"
        description="The header takes arbitrary controls left of the close button — the pattern BuilderGuideDialog needs for its 'Plain text' link."
      >
        <ComponentPreview
          code={`<DrawerHeader
  title="Builder guide"
  actions={
    <Button as="a" href="/builder/llms.txt" variant="ghost" size="xs">
      Plain text <ArrowSquareOutIcon className="size-3.5" />
    </Button>
  }
/>`}
        >
          <Button variant="secondary" onClick={() => setGuide(true)}>
            Open builder guide
          </Button>
          <Drawer open={guide} onOpenChange={setGuide}>
            <DrawerContent side="right" size="2xl">
              <DrawerHeader
                title="Builder guide"
                actions={
                  <Button as="a" href="#" variant="ghost" size="xs">
                    Plain text
                    <ArrowSquareOutIcon
                      className="size-3.5"
                      aria-hidden="true"
                    />
                  </Button>
                }
              />
              <DrawerBody>
                {Array.from({ length: 10 }).map((_, i) => (
                  <section key={i} className="mb-6">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                      Section {i + 1}
                    </h3>
                    <p className="text-sm text-text-secondary">
                      The body scrolls under a fixed, bordered header. The
                      border is deliberate: a drawer's content scrolls far more
                      often than a dialog's, and without it the text appears to
                      float out of nowhere.
                    </p>
                  </section>
                ))}
              </DrawerBody>
            </DrawerContent>
          </Drawer>
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="With a footer"
        description="Header, scrolling body and footer — the three-region layout CartDrawer needs for its subtotal and checkout action. `fit` sizes the panel to its content so the footer sits under the last item instead of at the foot of a column of empty space. The cart is inset 24px on all four sides."
      >
        <ComponentPreview
          code={`<DrawerContent side="right" size="sm" fit>
  <DrawerHeader title="Cart (2)" className="px-6 pt-6" />
  <DrawerBody className="px-6 py-0">…</DrawerBody>
  <DrawerFooter className="flex-col items-stretch gap-3 px-6 pb-6">
    <Button size="md">Checkout</Button>
  </DrawerFooter>
</DrawerContent>`}
        >
          <Button variant="secondary" onClick={() => setFooter(true)}>
            Open cart
          </Button>
          <Drawer open={footer} onOpenChange={setFooter}>
            <DrawerContent side="right" size="sm" fit>
              <DrawerHeader title="Cart (2)" className="px-6 pt-6" />
              <DrawerBody className="px-6 py-0">
                {['Classic Tee', 'Sticker Pack'].map((name) => (
                  <div
                    key={name}
                    className="flex items-center gap-3 border-b border-border-subtle py-4 last:border-b-0"
                  >
                    <div className="size-14 shrink-0 rounded-md bg-background-subtle" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {name}
                      </p>
                      <p className="text-xs text-text-muted">Qty 1</p>
                    </div>
                    <span className="text-sm font-medium text-text-primary">
                      $28.00
                    </span>
                  </div>
                ))}
              </DrawerBody>
              <DrawerFooter className="flex-col items-stretch gap-3 px-6 pb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Subtotal</span>
                  <span className="font-medium text-text-primary">$56.00</span>
                </div>
                <DrawerClose asChild>
                  <Button size="md">Checkout</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Motion"
        description="Drawers use --motion-duration-sheet (280ms) and --motion-ease-sheet, which already existed for exactly this and were previously used only by /shop. Dialog uses the faster --motion-duration-fast: a centred dialog appears, a sheet travels, and travel needs longer to read as physical."
      >
        <ul className="flex flex-col gap-2 text-sm text-text-secondary">
          {[
            'The panel slides only — no fade. The scrim fades.',
            'Exit animations play: Radix Presence waits for animationend before unmounting.',
            'prefers-reduced-motion removes the movement but keeps the state change.',
            'Bottom is centred with auto margins rather than a translate, so transform stays free for the slide — Tailwind v4 compiles -translate-x-1/2 to the independent translate property, which composes with transform rather than being replaced by it.',
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
