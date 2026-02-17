const SOLID_HOOKS_TO_TRANSFORM = [
  'useQuery',
  'useMutation',
  'useQueries',
  'useInfiniteQuery',
  'useMutationState',
]

export function transformSolidHookCalls(code: string): string {
  let result = code

  for (const hook of SOLID_HOOKS_TO_TRANSFORM) {
    // Match hook({ ... }) and replace with hook(() => ({ ... }))
    // This regex matches: hookName({ ... })
    // and replaces with: hookName(() => ({ ... }))
    const regex = new RegExp(`${hook}\\(\\s*(\\{[\\s\\S]*?\\})\\s*\\)`, 'g')
    result = result.replace(regex, `${hook}(() => ($1))`)
  }

  return result
}

export function transformSolidCodeBlocks(text: string): string {
  const codeBlockRegex = /```(?:tsx|ts|js|jsx|javascript|typescript)\n([\s\S]*?)```/g

  return text.replace(codeBlockRegex, (_match, code) => {
    const transformed = transformSolidHookCalls(code)
    return `\`\`\`\n${transformed}\`\`\``
  })
}
