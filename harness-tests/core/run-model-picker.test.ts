import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { RunModelPicker } from '../../src/chat/components/RunModelPicker'
import type { RunModelCatalog } from '../../src/chat/core/run-model'

// Render the popup inline so assertions cover the picker's actual choices.
vi.mock('@base-ui/react/popover', async () => {
  const { createElement } = await import('react')
  const children = (props: ComponentProps<'div'>) => props.children
  return {
    Popover: {
      Root: children,
      Portal: children,
      Positioner: children,
      Popup: children,
      Title: children,
      Trigger: (props: ComponentProps<'button'>) =>
        createElement('button', props),
    },
  }
})

const catalog: RunModelCatalog = {
  defaultSelection: { provider: 'openai', model: 'gpt-5.6-terra' },
  choices: ['gpt-5-mini', 'o3', 'gpt-5.6-terra', 'gpt-5.1', 'o3-mini'].map(
    (model) => ({
      selection: { provider: 'openai', model },
      label: model,
      providerLabel: 'OpenAI',
      attachments: [],
      reasoning: [{ value: 'default', label: 'Default' }],
      retiring: model === 'gpt-5-mini' || model === 'o3',
    }),
  ),
}

describe('retiring model picker choices', () => {
  it.each(['gpt-5.6-terra', 'gpt-5-mini'])(
    'keeps %s selected while hiding other retiring choices',
    (model) => {
      const html = renderToStaticMarkup(
        createElement(RunModelPicker, {
          model: {
            selection: { provider: 'openai', model },
            catalog,
            catalogReady: true,
            loading: false,
            refreshing: false,
            error: '',
            refetch: vi.fn(),
            select: vi.fn(),
          },
        }),
      )
      expect(html).toContain('<strong>gpt-5.6-terra</strong>')
      expect(html).toContain('<strong>gpt-5.1</strong>')
      expect(html).toContain('<strong>o3-mini</strong>')
      expect(html).not.toContain('<strong>o3</strong>')
      expect(html.includes('<strong>gpt-5-mini</strong>')).toBe(
        model === 'gpt-5-mini',
      )
      expect(html).toContain(`aria-label="Model: ${model}"`)
      expect(html).toContain('aria-pressed="true"')
    },
  )
})
