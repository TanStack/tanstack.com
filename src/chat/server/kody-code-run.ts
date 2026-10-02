import { parse, parseExpression } from '@babel/parser'
import { validateKodyExecution } from './kody-actions'

/** Build Kody's module contract from a plain source snippet and one result expression. */
export function compileKodyCodeRun(source: string, expression: string) {
  const body = source.trim()
  const result = expression.trim()
  if (!body || !result) throw new Error('Provide code and a result expression.')
  try {
    parse(body, { sourceType: 'script', plugins: ['typescript'] })
  } catch {
    throw new Error(
      'Use self-contained code without imports or exports. For Kody packages, inspect their contract and use Kody execution.',
    )
  }
  try {
    const node = parseExpression(result, {
      sourceType: 'module',
      plugins: ['typescript'],
    })
    if (node.end !== result.length) throw new Error('Trailing code')
  } catch {
    throw new Error(
      'The result must be one JavaScript or TypeScript expression.',
    )
  }
  const code = `export default async function main() {\n${body}\nreturn (${result});\n}`
  validateKodyExecution(code)
  return code
}
