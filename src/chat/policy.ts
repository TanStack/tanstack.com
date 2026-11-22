import { z } from 'zod'
import { providers } from './core/types'
export {
  policySchema as chatPolicySchema,
  defaultPolicy as defaultChatPolicy,
} from './core/types'
export type { Policy as ChatPolicy } from './core/types'
export const chatProviderSchema = z.enum(providers)
