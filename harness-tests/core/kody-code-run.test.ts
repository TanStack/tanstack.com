import { describe, expect, it } from 'vitest'
import { compileKodyCodeRun } from '../../src/chat/server/kody-code-run'

describe('Kody code run', () => {
  it('turns a plain function and expression into an executable Kody module', async () => {
    const code = compileKodyCodeRun(
      'function isEven(number) { return number % 2 === 0; }',
      'isEven(9)',
    )
    const module = await import(
      `data:text/javascript,${encodeURIComponent(code)}`
    )
    expect(await module.default()).toBe(false)
  })

  it.each([
    ['import helper from "other-package"', 'helper(9)'],
    ['export function helper() { return true }', 'helper()'],
    ['function helper() { return true }', 'helper(); throw Error("extra")'],
  ])(
    'rejects code outside the self-contained contract',
    (source, expression) => {
      expect(() => compileKodyCodeRun(source, expression)).toThrow()
    },
  )
})
