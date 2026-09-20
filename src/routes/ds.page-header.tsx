import { createFileRoute } from '@tanstack/react-router'
import { RssIcon, BookOpenIcon } from '@phosphor-icons/react'
import { seo } from '~/utils/seo'
import { PageHeader } from '~/components/ds/ui/PageHeader'
import { ComponentPreview, DsPage, DsSection } from '~/components/ds/DsKit'

export const Route = createFileRoute('/ds/page-header')({
  component: PageHeaderPage,
  head: () => ({
    meta: seo({
      title: 'Page Header | TanStack Design System',
      description:
        'The editorial page masthead — a large display title with an optional mark, a lede, and a trailing action. Left-aligned or centered.',
    }),
  }),
})

function PageHeaderPage() {
  return (
    <DsPage
      title="Page Header"
      description="An editorial masthead: a large display title paired with an optional leading mark (the TanStack emblem by default), a lede, and an optional trailing action. It backs the blog, merch store, and Design System overview. Emphasized words (wrapped in `<em>`) pick up the warm accent. Source: src/components/ds/ui/PageHeader.tsx."
    >
      <DsSection
        title="Left-aligned"
        description="`align='left'` (the default). The mark pairs with the title and the lede sits beneath — used on left-aligned catalog pages like this one."
      >
        <ComponentPreview
          className="p-8"
          code={`<PageHeader
  title="Design System"
  lede="A living catalog of the tokens and components that power TanStack."
/>`}
        >
          <PageHeader
            title="Design System"
            lede="A living catalog of the tokens and components that power TanStack."
          />
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Centered"
        description="`align='center'` centers the mark, title, and lede — the treatment used on the blog and merch mastheads."
      >
        <ComponentPreview
          className="p-8"
          code={`<PageHeader
  align="center"
  title="Blog"
  lede="The latest news and blog posts from TanStack."
/>`}
        >
          <PageHeader
            align="center"
            title="Blog"
            lede="The latest news and blog posts from TanStack."
          />
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Marks & actions"
        description="The mark defaults to the brand emblem (pass a custom `icon`, or `null` to omit it). Add a trailing `actions` node, and `withDivider` for a hairline beneath."
      >
        <ComponentPreview
          className="p-8"
          code={`{/* custom mark + trailing action + divider */}
<PageHeader
  icon={<BookOpenIcon />}
  title="Docs"
  lede="Guides, API references, and examples."
  actions={<a href="/rss.xml" aria-label="RSS feed"><RssIcon /></a>}
  withDivider
/>

{/* no mark */}
<PageHeader icon={null} title="Changelog" lede="What shipped, and when." />`}
        >
          <div className="w-full space-y-10">
            <PageHeader
              icon={
                <BookOpenIcon weight="bold" className="h-[0.9em] w-[0.9em]" />
              }
              title="Docs"
              lede="Guides, API references, and examples."
              withDivider
              actions={
                <a
                  href="/rss.xml"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="RSS feed"
                  className="grid place-items-center rounded-full p-1.5 text-text-secondary transition-colors hover:bg-surface-state-hover hover:text-text-primary"
                >
                  <RssIcon weight="bold" className="h-[18px] w-[18px]" />
                </a>
              }
            />
            <PageHeader
              icon={null}
              title="Changelog"
              lede="What shipped, and when."
            />
          </div>
        </ComponentPreview>
      </DsSection>
    </DsPage>
  )
}
