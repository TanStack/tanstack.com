import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseSiteMarkdown } from '../src/utils/markdown'
import {
  mapStartHostingPartnerElements,
  renderDynamicStartHostingGuide,
} from '../src/utils/start-hosting-guide'

const source = `Hosting introduction.

## What should I use?

Static partner recommendation.

## Deployment

- Static provider list

### Cloudflare Workers ⭐ _Official Partner_

Cloudflare instructions.

### Netlify ⭐ _Official Partner_

Netlify instructions.

### Railway ⭐ _Official Partner_

Railway instructions.

### Nitro

Nitro instructions.

### Vercel

Legacy Vercel instructions.

### Node.js / Docker

Node instructions.`

describe('renderDynamicStartHostingGuide', () => {
  it('replaces static recommendations and follows dynamic partner order', () => {
    const result = renderDynamicStartHostingGuide(source, [
      { id: 'railway', name: 'Railway' },
      { id: 'cloudflare', name: 'Cloudflare' },
      { id: 'render', name: 'Render' },
      { id: 'lovable', name: 'Lovable' },
      { id: 'vercel', name: 'Vercel' },
      { id: 'netlify', name: 'Netlify' },
    ])

    assert.doesNotMatch(result, /Static partner recommendation/)
    assert.doesNotMatch(result, /Static provider list/)
    assert.match(result, /<start-hosting-partners><\/start-hosting-partners>/)
    assert.match(
      result,
      /<start-hosting-lovable-logo><\/start-hosting-lovable-logo>/,
    )
    assert.match(
      result,
      /<start-hosting-render-logo><\/start-hosting-render-logo>/,
    )
    assert.match(
      result,
      /<start-hosting-vercel-logo><\/start-hosting-vercel-logo>/,
    )
    assert.doesNotMatch(result, /Legacy Vercel instructions/)
    assert.ok(
      result.indexOf('Railway instructions.') <
        result.indexOf('Cloudflare instructions.'),
    )
    assert.ok(
      result.indexOf('Cloudflare instructions.') <
        result.indexOf('TanStack Start runs on Render as a Node web service'),
    )
    assert.ok(
      result.indexOf('TanStack Start runs on Render as a Node web service') <
        result.indexOf('Lovable is different from a general-purpose'),
    )
    assert.ok(
      result.indexOf('Lovable is different from a general-purpose') <
        result.indexOf('Vercel supports TanStack Start through Nitro'),
    )
    assert.ok(
      result.indexOf('Vercel supports TanStack Start through Nitro') <
        result.indexOf('Netlify instructions.'),
    )
    assert.ok(
      result.indexOf('Netlify instructions.') <
        result.indexOf('Other deployment targets'),
    )
    assert.ok(
      result.indexOf('Other deployment targets') <
        result.indexOf('Nitro instructions.'),
    )
  })

  it('keeps the source unchanged when the expected sections are absent', () => {
    assert.equal(
      renderDynamicStartHostingGuide('## Hosting\n\nNothing static.', []),
      '## Hosting\n\nNothing static.',
    )
  })

  it('keeps an unmatched official guide without putting it among other targets', () => {
    const result = renderDynamicStartHostingGuide(source, [
      { id: 'cloudflare', name: 'Cloudflare' },
      { id: 'railway', name: 'Railway' },
    ])

    assert.ok(
      result.indexOf('Netlify instructions.') <
        result.indexOf('Other deployment targets'),
    )
  })

  it('maps the hosting placeholder to a renderable component node', () => {
    const document = mapStartHostingPartnerElements(
      parseSiteMarkdown('<start-hosting-partners></start-hosting-partners>'),
    )

    assert.equal(document.children[0]?.type, 'component')
    if (document.children[0]?.type !== 'component') return
    assert.equal(document.children[0].tagName, 'start-hosting-partners')
  })

  it('maps partner logo placeholders to renderable component nodes', () => {
    for (const partnerId of ['lovable', 'render', 'vercel']) {
      const tagName = `start-hosting-${partnerId}-logo`
      const document = mapStartHostingPartnerElements(
        parseSiteMarkdown(`<${tagName}></${tagName}>`),
      )

      assert.equal(document.children[0]?.type, 'component')
      if (document.children[0]?.type !== 'component') continue
      assert.equal(document.children[0].tagName, tagName)
    }
  })
})
