import type { CloudflareBindingConfig } from '@tanstack/ai-cloudflare'
import type { GatewayEnv } from './gateway'
export interface ProviderEnv extends GatewayEnv {
  AI: CloudflareBindingConfig['binding']
  INCLUDED_MODEL: string
}
import { z } from 'zod'
import { createGumCloudflareText as createCloudflareText } from './cloudflare-text'
import { createOpenaiChat, OPENAI_CHAT_MODELS } from '@tanstack/ai-openai'
import { createAnthropicChat, ANTHROPIC_MODELS } from '@tanstack/ai-anthropic'
import { createGeminiChat, GEMINI_MODELS } from '@tanstack/ai-gemini'
import { createGroqText, GROQ_CHAT_MODELS } from '@tanstack/ai-groq'
import { createGrokText, GROK_CHAT_MODELS } from '@tanstack/ai-grok'
import {
  createVercelGatewayText,
  VERCEL_GATEWAY_CHAT_MODELS,
} from '@tanstack/ai-vercel-gateway'
import { openaiCompatibleText } from '@tanstack/ai-openai/compatible'
import type { Connection } from '../core/types'
import {
  providerGateway,
  gatewayOptions,
  metadataOnlyBinding,
  type GatewayContext,
} from './gateway'
import { validateEndpoint } from './public-endpoint'
import {
  observeProviderBinding,
  observeProviderFetch,
  type ProviderAttemptObserver,
  type ProviderProtocol,
} from './provider-observation'
export { validateEndpoint } from './public-endpoint'
export function adapterFor(
  connection: Connection,
  env: ProviderEnv,
  context?: GatewayContext,
  observer?: ProviderAttemptObserver,
) {
  const c = connection
  const key = c.apiKey ?? ''
  const gateway = providerGateway(c.provider, env, context)
  const observedFetch = (protocol: ProviderProtocol) =>
    observer ? { fetch: observeProviderFetch(protocol, observer) } : undefined
  if (c.provider === 'included') {
    if (!env.AI)
      throw new Error(
        'The included model is unavailable on this server. Add a provider API key in settings.',
      )
    const binding = env.AI_GATEWAY_ID ? metadataOnlyBinding(env.AI) : env.AI
    return createCloudflareText(c.model || env.INCLUDED_MODEL, {
      binding: observer ? observeProviderBinding(binding, observer) : binding,
      ...(env.AI_GATEWAY_ID
        ? {
            gateway: gatewayOptions(env.AI_GATEWAY_ID, context),
          }
        : {}),
    })
  }
  if (!key) throw new Error('Add an API key in settings to use this provider.')
  if (!c.model.trim()) throw new Error('Choose a model in settings.')
  switch (c.provider) {
    case 'openai':
      return createOpenaiChat(z.enum(OPENAI_CHAT_MODELS).parse(c.model), key, {
        ...gateway,
        ...observedFetch('openai-responses'),
      })
    case 'anthropic':
      return createAnthropicChat(z.enum(ANTHROPIC_MODELS).parse(c.model), key, {
        ...gateway,
        ...observedFetch('anthropic'),
      })
    case 'gemini':
      return createGeminiChat(z.enum(GEMINI_MODELS).parse(c.model), key, {
        ...gateway,
        ...(observer
          ? { httpOptions: { fetch: observeProviderFetch('gemini', observer) } }
          : {}),
      })
    case 'groq':
      return createGroqText(z.enum(GROQ_CHAT_MODELS).parse(c.model), key, {
        ...gateway,
        ...observedFetch('openai-chat'),
      })
    case 'grok':
      return createGrokText(z.enum(GROK_CHAT_MODELS).parse(c.model), key, {
        ...gateway,
        ...observedFetch('openai-responses'),
      })
    case 'openrouter':
      return openaiCompatibleText(c.model, {
        apiKey: key,
        baseURL: 'https://openrouter.ai/api/v1',
        ...gateway,
        maxRetries: 0,
        ...observedFetch('openai-chat'),
      })
    case 'vercel':
      if (!(VERCEL_GATEWAY_CHAT_MODELS as readonly string[]).includes(c.model))
        return openaiCompatibleText(c.model, {
          apiKey: key,
          baseURL: 'https://ai-gateway.vercel.sh/v1',
          maxRetries: 0,
          ...observedFetch('openai-chat'),
        })
      return createVercelGatewayText(
        z.enum(VERCEL_GATEWAY_CHAT_MODELS).parse(c.model),
        key,
        observedFetch('openai-responses'),
      )
    case 'cloudflare':
      if (!c.accountId) throw new Error('Add your Cloudflare account ID.')
      return createCloudflareText(c.model, {
        accountId: c.accountId,
        apiKey: key,
        ...observedFetch('openai-chat'),
        ...(c.gatewayId
          ? {
              gateway: gatewayOptions(c.gatewayId, context),
              defaultHeaders: { 'cf-aig-collect-log-payload': 'false' },
            }
          : {}),
      })
    case 'cf_gateway':
      if (!c.accountId || !c.gatewayId)
        throw new Error('Add your Cloudflare account and Gateway IDs.')
      return openaiCompatibleText(c.model, {
        apiKey: key,
        baseURL: `https://api.cloudflare.com/client/v4/accounts/${c.accountId}/ai/v1`,
        defaultHeaders: {
          'cf-aig-gateway-id': c.gatewayId,
          'cf-aig-collect-log-payload': 'false',
        },
        maxRetries: 0,
        ...observedFetch('openai-chat'),
      })
    case 'compatible':
      return openaiCompatibleText(c.model, {
        apiKey: key,
        baseURL: validateEndpoint(c.baseUrl),
        maxRetries: 0,
        timeout: 90000,
        ...observedFetch('openai-chat'),
      })
  }
}
