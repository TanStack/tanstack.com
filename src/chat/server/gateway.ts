import { cloudflareGateway } from '@tanstack/ai-cloudflare'
import type { Provider } from '../core/types'
import type { UsageContext } from './usage'
export interface GatewayEnv {
  AI_GATEWAY_ID?: string
  AI_GATEWAY_ACCOUNT_ID?: string
  AI_GATEWAY_TOKEN?: string
}
export interface GatewayContext extends UsageContext {
  stepId?: string
}
export function gatewayOptions(id: string, context?: GatewayContext) {
  return {
    id,
    skipCache: true,
    collectLog: true,
    ...(context
      ? {
          eventId: context.stepId ?? context.turnId,
          metadata: {
            turnId: context.turnId,
            workspaceId: context.workspaceId,
            userId: context.userId,
            ...(context.stepId ? { stepId: context.stepId } : {}),
          },
        }
      : {}),
  }
}
const paths: Partial<Record<Provider, string>> = {
  openai: 'openai',
  anthropic: 'anthropic',
  gemini: 'google-ai-studio',
  groq: 'groq',
  grok: 'grok',
  openrouter: 'openrouter',
}
export function providerGateway(
  provider: Provider,
  env: GatewayEnv,
  context?: GatewayContext,
) {
  const path = paths[provider]
  // Worker bindings authenticate themselves. Provider-native HTTP routes need
  // a separate Gateway run token when the gateway requires authentication.
  if (!env.AI_GATEWAY_ID || !env.AI_GATEWAY_TOKEN || !path) return undefined
  if (
    !env.AI_GATEWAY_ACCOUNT_ID ||
    !/^[a-f0-9]{32}$/.test(env.AI_GATEWAY_ACCOUNT_ID)
  )
    throw new Error('Configure a valid AI Gateway account ID.')
  if (!/^[\w-]{1,100}$/.test(env.AI_GATEWAY_ID))
    throw new Error('Configure a valid AI Gateway ID.')
  const { baseURL, headers } = cloudflareGateway(path, {
    accountId: env.AI_GATEWAY_ACCOUNT_ID,
    gatewayId: env.AI_GATEWAY_ID,
    cfApiKey: env.AI_GATEWAY_TOKEN,
    ...gatewayOptions(env.AI_GATEWAY_ID, context),
  })
  return {
    baseURL,
    defaultHeaders: { ...headers, 'cf-aig-collect-log-payload': 'false' },
    maxRetries: 0,
  }
}
/** The adapter forwards gateway options, but not extraHeaders. Preserve the
 * native binding and add the documented payload logging control at run(). */
export function metadataOnlyBinding<
  T extends { run: (...args: never[]) => unknown },
>(binding: T): T {
  return new Proxy(binding, {
    get(target, property) {
      if (property === 'run')
        return (
          model: string,
          inputs: unknown,
          options?: Record<string, unknown>,
        ) => {
          return Reflect.apply(target.run, target, [
            model,
            inputs,
            {
              ...options,
              extraHeaders: { 'cf-aig-collect-log-payload': 'false' },
            },
          ])
        }
      const value = Reflect.get(target, property)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}
