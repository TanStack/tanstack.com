import { z } from 'zod'
export const answerRequestSchema = z.object({
  question: z.string().trim().min(1).max(12000),
  constraints: z.object({
    allowChatModels: z.boolean(),
    maxSearches: z.number().int().min(1).max(2),
  }),
})
export const answerResultSchema = z
  .object({
    version: z.literal(1),
    status: z.enum([
      'answered',
      'no_answer',
      'needs_setup',
      'unsupported',
      'error',
    ]),
    message: z.string().max(1000).optional(),
    evidence: z
      .array(
        z.object({
          text: z.string().max(1600),
          title: z.string().max(300),
          url: z
            .string()
            .url()
            .refine((url) => new URL(url).protocol === 'https:'),
        }),
      )
      .max(5),
    usage: z.object({
      jevCalls: z.number().int().min(0).max(10),
      chatModelCalls: z.number().int().min(0).max(10),
      searches: z.number().int().min(0).max(2),
      inputTokens: z.number().int().min(0),
      outputTokens: z.number().int().min(0),
    }),
  })
  .superRefine((result, ctx) => {
    if (result.status === 'answered' && !result.evidence.length)
      ctx.addIssue({
        code: 'custom',
        message: 'An answer must include evidence.',
      })
  })
export type AnswerResult = z.infer<typeof answerResultSchema>
const escapeMarkdown = (text: string) =>
  text.replace(/[\\`*_{}\[\]<>#!|]/g, '\\$&')
export function formatAnswer(result: AnswerResult) {
  if (result.status !== 'answered') {
    const messages = {
      no_answer:
        'Kody could not find a clear, supported answer. Try a more specific question.',
      needs_setup:
        'Your Kody answer package needs setup. Check its saved Jev and search credentials in Kody.',
      unsupported:
        'The Kody answer package cannot answer that question under the current restrictions.',
      error:
        'Kody could not complete the lookup. No chat model fallback was used.',
    }
    return messages[result.status]
  }
  return result.evidence
    .map(
      (source) =>
        `> ${escapeMarkdown(source.text).replaceAll('\n', '\n> ')}\n\n[${escapeMarkdown(source.title)}](<${source.url.replace(/[<>\s]/g, (c) => encodeURIComponent(c))}>)`,
    )
    .join('\n\n')
}
