import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChartsCatalogDocExample } from '../src/components/charts/ChartsCatalogDocExample'
import { ChartsCatalogEmbed } from '../src/components/charts/ChartsCatalogEmbed'
import {
  isChartsCatalogEmbedPath,
  mapChartsCatalogEmbeds,
  parseChartsCatalogExampleAttributes,
  parseChartsCatalogEmbed,
} from '../src/utils/charts-catalog-embed'
import { isFrameEmbeddingAllowed } from '../src/utils/frame-embedding'
import { parseSiteMarkdown } from '../src/utils/markdown'

test('only current embed documents bypass the global frame denial', () => {
  assert.equal(isFrameEmbeddingAllowed('/partners-embed'), true)
  assert.equal(isFrameEmbeddingAllowed('/sponsors-embed'), true)
  assert.equal(isFrameEmbeddingAllowed('/stats/npm/embed'), true)

  for (const pathname of [
    '/partners',
    '/sponsors',
    '/charts/catalog/',
    '/charts/catalog/charts/01-line/',
    '/charts/catalog/embed/01-line',
    '/charts/catalog/embed/01-line/',
    '/charts/catalog/embed/',
    '/charts/catalog/embed/01-line/source/',
    '/charts/catalog/embed-malicious/01-line/',
    '/charts/catalog/embed/../admin/',
    '/charts/catalog/embed/%2e%2e/',
    '/charts/catalog/embed/01_line/',
    '/charts/catalog/embed/01-line/?compare=1',
  ]) {
    assert.equal(
      isFrameEmbeddingAllowed(pathname),
      false,
      `${pathname} must retain frame denial`,
    )
  }
})

test('catalog embed source validation is same-origin and parameter bounded', () => {
  assert.deepEqual(
    parseChartsCatalogEmbed(
      'https://tanstack.com/charts/catalog/embed/01-line/?theme=dark&height=420&revision=2',
    ),
    {
      caseId: '01-line',
      origin: 'https://tanstack.com',
      source: 'hidden',
    },
  )

  assert.deepEqual(
    parseChartsCatalogEmbed(
      'https://tanstack.com/charts/catalog/embed/01-line/?source=expanded',
    ),
    {
      caseId: '01-line',
      origin: 'https://tanstack.com',
      source: 'expanded',
    },
  )

  for (const source of [
    'http://tanstack.com/charts/catalog/embed/01-line/',
    'https://charts.tanstack.com/charts/catalog/embed/01-line/',
    'https://tanstack.com:444/charts/catalog/embed/01-line/',
    'https://tanstack.com/charts/catalog/embed/01-line/?compare=1',
    'https://tanstack.com/charts/catalog/embed/01-line/?height=119',
    'https://tanstack.com/charts/catalog/embed/01-line/?revision=10001',
    'https://tanstack.com/charts/catalog/embed/01-line/?source=true',
    'https://tanstack.com/charts/catalog/embed/01-line/#fragment',
  ]) {
    assert.equal(parseChartsCatalogEmbed(source), null, source)
  }
})

test('embed path validation uses the producer case-id grammar', () => {
  assert.equal(isChartsCatalogEmbedPath('/charts/catalog/embed/01-line/'), true)
  assert.equal(
    isChartsCatalogEmbedPath('/charts/catalog/embed/01_line/'),
    false,
  )
  assert.equal(
    isChartsCatalogEmbedPath('/charts/catalog/embed/01.line/'),
    false,
  )
})

test('chart docs can promote trusted raw iframes to source-aware embeds', () => {
  const document = mapChartsCatalogEmbeds(
    {
      type: 'root',
      children: [
        {
          type: 'html',
          value: `<iframe
  src="https://tanstack.com/charts/catalog/embed/01-line/?theme=system&amp;height=400"
  title="Line chart"
  loading="lazy"
  width="100%"
  height="400"
  style="width:100%;height:400px;border:0;"
></iframe>`,
        },
      ],
    },
    'collapsed',
  )

  assert.deepEqual(document.children[0], {
    type: 'component',
    name: 'chart-catalog-embed',
    tagName: 'chart-catalog-embed',
    attributes: {},
    properties: {
      src: 'https://tanstack.com/charts/catalog/embed/01-line/?theme=system&height=400&source=collapsed',
      title: 'Line chart',
      loading: 'lazy',
      width: '100%',
      height: '400',
    },
    children: [],
  })
})

test('chart example comments validate their source reference', () => {
  assert.deepEqual(
    parseChartsCatalogExampleAttributes({
      id: '01-line-gaps',
      height: '480',
    }),
    { caseId: '01-line-gaps', height: 480 },
  )

  for (const attributes of [
    { id: '../line-gaps', height: '480' },
    { id: '01-line-gaps', height: '479' },
    { id: '01-line-gaps', height: '1201' },
    { id: '01-line-gaps', height: '480', src: 'https://example.com' },
  ]) {
    assert.equal(parseChartsCatalogExampleAttributes(attributes), null)
  }
})

test('chart example comments retain a useful static document', () => {
  const document = parseSiteMarkdown(
    '<!-- ::chart-example id=01-line-gaps height=480 -->',
  )
  const block = document.children[0]
  assert.equal(block?.type, 'component')
  if (block?.type !== 'component') return

  const example = parseChartsCatalogExampleAttributes(block.attributes)
  assert.ok(example)
  const html = renderToStaticMarkup(
    createElement(ChartsCatalogDocExample, example),
  )

  assert.match(html, /data-chart-example="01-line-gaps"/)
  assert.match(html, /data-chart-example-state="static"/)
  assert.match(html, /data-catalog-preview-case="01-line-gaps"/)
  assert.match(html, /height:480px/)
  assert.match(html, />Edit</)
  assert.match(html, />Run</)
  assert.doesNotMatch(html, /<iframe/)
})

test('legacy chart iframe markup renders through the inline fallback', () => {
  const html = renderToStaticMarkup(
    createElement(ChartsCatalogEmbed, {
      height: 480,
      src: 'https://tanstack.com/charts/catalog/embed/01-line-gaps/',
      title: 'Line chart',
    }),
  )

  assert.match(html, /data-chart-example="01-line-gaps"/)
  assert.match(html, /Line chart/)
  assert.doesNotMatch(html, /<iframe/)
})
