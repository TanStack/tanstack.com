import {
  getTabbedMenuConfig,
  getActiveDocsNavTabId,
} from '../src/utils/docsNavTabs'
import { customToolTabs } from '../src/libraries/custom-tool-tabs'
import assert from 'node:assert/strict'
import {
  getLibraryLayoutVersion,
  getLibraryTabLinkOptions,
  getMenuGroupInitialOpenState,
  isChartsCatalogTarget,
} from '../src/components/library-layout-navigation'

assert.equal(isChartsCatalogTarget('/charts/catalog'), true)
assert.equal(isChartsCatalogTarget('/charts/catalog/charts/01-line'), true)
assert.equal(isChartsCatalogTarget('/charts/catalog/collections/shadcn'), true)
assert.equal(isChartsCatalogTarget('/charts/catalogue'), false)

assert.equal(
  getLibraryLayoutVersion({
    layoutVersion: 'v0',
    pathname: '/charts/catalog',
    routeVersion: undefined,
  }),
  'latest',
  'the versionless catalog generates canonical docs links instead of redirecting version aliases',
)
assert.equal(
  getLibraryLayoutVersion({
    layoutVersion: 'v0',
    pathname: '/charts/v0/docs/overview',
    routeVersion: 'v0',
  }),
  'v0',
  'versioned docs retain their requested version',
)
assert.equal(
  getLibraryLayoutVersion({
    layoutVersion: 'v1',
    pathname: '/table',
    routeVersion: undefined,
  }),
  'v1',
  'other versionless library pages retain their layout version',
)

assert.deepEqual(
  getLibraryTabLinkOptions({
    libraryId: 'table',
    version: 'latest',
    to: '..',
  }),
  {
    from: undefined,
    to: '/table/latest',
    params: undefined,
  },
  'a landing-page Home tab uses its concrete route instead of the generic library route',
)

assert.deepEqual(
  getLibraryTabLinkOptions({
    libraryId: 'table',
    version: 'v8',
    to: 'guide/intro',
  }),
  {
    from: '/$libraryId/$version/docs',
    to: 'guide/intro',
    params: { libraryId: 'table', version: 'v8' },
  },
  'relative docs tabs retain their generic docs-route context',
)

const groups = [
  {
    label: 'Individual Charts',
    collapsible: true,
    defaultCollapsed: true,
    children: [
      {
        label: 'Line gaps',
        to: '/charts/catalog/charts/01-line-gaps',
      },
    ],
  },
]

assert.deepEqual(
  getMenuGroupInitialOpenState(
    'charts',
    groups,
    undefined,
    '/charts/catalog/charts/01-line-gaps/',
  ),
  { '0:Individual Charts': true },
  'the active catalog detail opens its default-collapsed group',
)

assert.deepEqual(
  getMenuGroupInitialOpenState('charts', groups, undefined, '/charts/catalog'),
  { '0:Individual Charts': false },
  'an inactive catalog group keeps its configured collapsed state',
)

assert.deepEqual(
  getLibraryTabLinkOptions({
    libraryId: 'highlight',
    version: 'latest',
    to: '/highlight/$version/theme-editor',
  }),
  {
    from: undefined,
    to: '/highlight/$version/theme-editor',
    params: { version: 'latest' },
  },
  'the theme editor uses its own versioned route without a docs route prefix',
)

const catalogGroups = groups.map((group) => ({
  ...group,
  children: group.children.map((child) => ({
    ...child,
    label: 'Example chart',
  })),
}))
const chartsTabs = getTabbedMenuConfig(catalogGroups, customToolTabs.charts)
assert.equal(chartsTabs.filter((tab) => tab.label === 'Examples').length, 1)
const examplesTab = chartsTabs.find((tab) => tab.id === 'examples')
assert.equal(examplesTab?.firstItem?.to, '/charts/catalog')
assert.equal(
  examplesTab?.groups[0]?.children.length,
  groups[0]?.children.length,
)
assert.equal(
  getActiveDocsNavTabId({
    tabIdOverride: 'examples',
    menuConfig: catalogGroups,
    pathname: '/charts/catalog/charts/01-line-gaps/',
    relativePathname: '',
  }),
  examplesTab?.id,
)
assert.equal(
  getTabbedMenuConfig([], customToolTabs.charts)[0]?.firstItem?.to,
  '/charts/catalog',
)
const highlightTabs = getTabbedMenuConfig([], customToolTabs.highlight)
assert.equal(highlightTabs[0]?.id, 'theme-editor')
assert.equal(
  highlightTabs[0]?.firstItem?.to,
  '/highlight/$version/theme-editor',
)
assert.ok(highlightTabs[0]?.firstItem)
assert.deepEqual(
  getLibraryTabLinkOptions({
    libraryId: 'highlight',
    version: 'v1',
    to: highlightTabs[0].firstItem.to,
  }),
  {
    from: undefined,
    to: '/highlight/$version/theme-editor',
    params: { version: 'v1' },
  },
)

console.log('charts sidebar navigation tests passed')
