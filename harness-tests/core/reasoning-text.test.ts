import { expect, it } from 'vitest'
import { ReasoningTextFilter } from '../../src/chat/core/reasoning-text'
it('removes closing tags split across provider chunks', () => {
  const filter = new ReasoningTextFilter()
  expect(filter.push('Hello</thi') + filter.push('nk> there')).toBe(
    'Hello there',
  )
})
it('keeps tagged reasoning out of the transcript', () => {
  const filter = new ReasoningTextFilter()
  expect(
    filter.push('<thi') +
      filter.push('nk>private') +
      filter.push('</think>Answer'),
  ).toBe('Answer')
})
it('retains ordinary trailing angle brackets', () => {
  const filter = new ReasoningTextFilter()
  expect(filter.push('Value <') + filter.push('', true)).toBe('Value <')
})
