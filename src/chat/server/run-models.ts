import { OPENAI_CHAT_MODELS } from '@tanstack/ai-openai'
import { ANTHROPIC_MODELS } from '@tanstack/ai-anthropic'
import { GEMINI_MODELS } from '@tanstack/ai-gemini'
import { GROQ_CHAT_MODELS } from '@tanstack/ai-groq'
import { GROK_CHAT_MODELS } from '@tanstack/ai-grok'
import { VERCEL_GATEWAY_CHAT_MODELS } from '@tanstack/ai-vercel-gateway'
import { OPENROUTER_CHAT_MODELS } from '@tanstack/ai-openrouter/model-meta'
import {
  runModelSchema,
  type RunModelCatalog,
  type RunModelChoice,
  type RunModelSelection,
} from '../core/run-model'
import {
  connectionSchema,
  providers,
  type Connection,
  type Credentials,
  type Policy,
  type Provider,
} from '../core/types'
import { enforceModel } from '../core/routing'
import { readCredentials, type CredentialEnv } from './credentials'
export interface ModelEnvironment extends CredentialEnv {
  INCLUDED_MODEL: string
}
import { modelAttachmentSupport } from './model-attachments'
import { validateEndpoint } from './public-endpoint'

export class RunModelError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message)
    this.name = 'RunModelError'
  }
}

interface ModelScope {
  userId: string
  policy: Policy
  fixture: boolean
}

const providerLabels: Record<Provider, string> = {
  included: 'Included',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Google Gemini',
  groq: 'Groq',
  grok: 'xAI',
  openrouter: 'OpenRouter',
  vercel: 'Vercel AI Gateway',
  cloudflare: 'Cloudflare Workers AI',
  cf_gateway: 'Cloudflare AI Gateway',
  compatible: 'Compatible API',
}
const modelLabels: Record<string, string> = {
  '@cf/zai-org/glm-5.3-flash': 'GLM 5.3 Flash',
  '@cf/moonshotai/kimi-k2.5': 'Kimi K2.5',
  '@cf/moonshotai/kimi-k2.6': 'Kimi K2.6',
  '@cf/openai/gpt-oss-20b': 'GPT OSS 20B',
  '@cf/openai/gpt-oss-120b': 'GPT OSS 120B',
}
const nativeModels: Partial<Record<Provider, readonly string[]>> = {
  openai: OPENAI_CHAT_MODELS,
  anthropic: ANTHROPIC_MODELS,
  gemini: GEMINI_MODELS,
  groq: GROQ_CHAT_MODELS,
  grok: GROK_CHAT_MODELS,
  openrouter: OPENROUTER_CHAT_MODELS.filter(
    (model) => !model.startsWith('~') && !model.endsWith(':batch'),
  ),
  vercel: VERCEL_GATEWAY_CHAT_MODELS,
}
const maxProviderModels = 512
const maxCatalogModels = 2048
const isNative = (provider: Provider, model: string) =>
  nativeModels[provider]?.includes(model) === true

/** Exact reviewed model IDs only. An adapter update does not enable new controls. */
const openaiEfforts: Record<string, readonly string[]> = {
  'gpt-6-astra': ['low', 'medium', 'high'],
  'gpt-5.5': ['none', 'low', 'medium', 'high'],
  'gpt-5.2': ['none', 'low', 'medium', 'high'],
  'gpt-5.1': ['none', 'low', 'medium', 'high'],
  'gpt-5': ['minimal', 'low', 'medium', 'high'],
  'gpt-5-mini': ['minimal', 'low', 'medium', 'high'],
  'gpt-5-nano': ['minimal', 'low', 'medium', 'high'],
  'gpt-5-pro': ['high'],
  o3: ['low', 'medium', 'high'],
  'o3-mini': ['low', 'medium', 'high'],
  'o4-mini': ['low', 'medium', 'high'],
}
const anthropicEfforts: Record<string, readonly string[]> = {
  'claude-opus-4-6': ['low', 'medium', 'high', 'max'],
  'claude-sonnet-4-6': ['low', 'medium', 'high', 'max'],
  'claude-opus-4-7': ['low', 'medium', 'high', 'xhigh', 'max'],
  'claude-opus-4-8': ['low', 'medium', 'high', 'xhigh', 'max'],
  'claude-fable-5': ['low', 'medium', 'high', 'xhigh', 'max'],
  'claude-sonnet-5': ['low', 'medium', 'high', 'xhigh', 'max'],
}
const geminiLevels: Record<string, readonly string[]> = {
  'gemini-3.8-flash': ['low', 'medium', 'high'],
  'gemini-3.7-flash': ['low', 'medium', 'high'],
  'gemini-3.6-flash': ['minimal', 'low', 'medium', 'high'],
  'gemini-3.5-flash': ['minimal', 'low', 'medium', 'high'],
  'gemini-3.5-flash-lite': ['minimal', 'low', 'medium', 'high'],
  'gemini-3.1-pro-preview': ['low', 'medium', 'high'],
  'gemini-3-flash-preview': ['minimal', 'low', 'medium', 'high'],
  'gemini-3.1-flash-lite': ['minimal', 'low', 'medium', 'high'],
  'gemini-3.1-flash-lite-preview': ['minimal', 'low', 'medium', 'high'],
}
const kimi = new Set(['@cf/moonshotai/kimi-k2.5', '@cf/moonshotai/kimi-k2.6'])
const cfOss = new Set(['@cf/openai/gpt-oss-20b', '@cf/openai/gpt-oss-120b'])
const glmFlash = '@cf/zai-org/glm-5.3-flash'
const reasoningLabels: Record<string, string> = {
  default: 'Default',
  none: 'Off',
  off: 'Off',
  on: 'On',
  dynamic: 'Automatic',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Maximum',
}

function reasoningValues(provider: Provider, model: string): readonly string[] {
  if (nativeModels[provider] && !isNative(provider, model)) return []
  if (provider === 'included' || provider === 'cloudflare') {
    if (kimi.has(model)) return ['off', 'on']
    if (cfOss.has(model)) return ['low', 'medium', 'high']
    // Only the overlap between the model guide and hosted request contract.
    if (model === glmFlash) return ['low', 'high']
  }
  if (provider === 'openai') return openaiEfforts[model] ?? []
  if (provider === 'anthropic') return anthropicEfforts[model] ?? []
  if (provider === 'gemini') {
    if (geminiLevels[model]) return geminiLevels[model]
    if (model === 'gemini-2.5-pro') return ['dynamic']
    if (['gemini-2.5-flash', 'gemini-2.5-flash-lite'].includes(model))
      return ['off', 'dynamic']
  }
  if (
    provider === 'groq' &&
    ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'].includes(model)
  )
    return ['low', 'medium', 'high']
  if (
    provider === 'grok' &&
    ['grok-4.5', 'grok-4.6', 'grok-4.7'].includes(model)
  )
    return ['low', 'medium', 'high']
  // A gateway model name does not prove how that endpoint maps reasoning options.
  return []
}

function kimiThinkingOptions(model: string, enabled: boolean) {
  // K2.6 renamed this option; retain K2.5's documented wire format.
  return model === '@cf/moonshotai/kimi-k2.6'
    ? { thinking: enabled }
    : { enable_thinking: enabled }
}

function modelOptions(selection: RunModelSelection): Record<string, unknown> {
  const { provider, model, reasoning } = selection
  const defaults: Record<string, unknown> =
    provider === 'openai' ||
    provider === 'grok' ||
    (provider === 'vercel' && isNative(provider, model))
      ? { max_output_tokens: 2048 }
      : provider === 'gemini'
        ? { maxOutputTokens: 2048 }
        : { max_tokens: 2048 }
  if (provider === 'included') {
    if (kimi.has(model))
      Object.assign(defaults, {
        reasoning_effort: null,
        chat_template_kwargs: kimiThinkingOptions(model, false),
      })
    if (cfOss.has(model))
      Object.assign(defaults, {
        reasoning_effort: 'low',
        chat_template_kwargs: { enable_thinking: true },
      })
    if (model === glmFlash) defaults.reasoning_effort = 'low'
  }
  if (!reasoning || reasoning === 'default') return defaults
  if (provider === 'included' || provider === 'cloudflare') {
    if (kimi.has(model)) {
      if (reasoning === 'on') delete defaults.reasoning_effort
      else defaults.reasoning_effort = null
      return {
        ...defaults,
        chat_template_kwargs: kimiThinkingOptions(model, reasoning === 'on'),
      }
    }
    return { ...defaults, reasoning_effort: reasoning }
  }
  if (provider === 'openai' || provider === 'grok')
    return { ...defaults, reasoning: { effort: reasoning } }
  if (provider === 'anthropic')
    return {
      ...defaults,
      thinking: { type: 'adaptive' },
      output_config: { effort: reasoning },
    }
  if (provider === 'gemini')
    return {
      ...defaults,
      thinkingConfig: geminiLevels[model]
        ? { thinkingLevel: reasoning.toUpperCase() }
        : { thinkingBudget: reasoning === 'off' ? 0 : -1 },
    }
  if (provider === 'groq') return { ...defaults, reasoning_effort: reasoning }
  return defaults
}

async function configuration(
  env: ModelEnvironment,
  scope: ModelScope,
  currentCredentials?: Credentials | null,
) {
  const included = connectionSchema.safeParse({
    provider: 'included',
    model: env.INCLUDED_MODEL,
  })
  if (!included.success || !included.data.model.trim())
    throw new RunModelError('The included model is not configured.', 503)
  // Fixture runs must never read or resolve a viewer's personal provider keys.
  const credentials = scope.fixture
    ? null
    : currentCredentials === undefined
      ? await readCredentials(env, scope.userId)
      : currentCredentials
  const connections = new Map<Provider, Connection>([
    ['included', included.data],
  ])
  for (const provider of providers) {
    if (provider === 'included') continue
    const saved = connectionSchema.safeParse(
      credentials?.connections?.[provider],
    )
    const legacy = connectionSchema.safeParse(credentials?.connection)
    const connection =
      saved.success && saved.data.provider === provider
        ? saved.data
        : legacy.success && legacy.data.provider === provider
          ? legacy.data
          : undefined
    if (connection) connections.set(provider, connection)
  }
  const current = connectionSchema.safeParse(credentials?.connection)
  const defaultConnection =
    current.success && current.data.provider !== 'included'
      ? (connections.get(current.data.provider) ?? current.data)
      : included.data
  return {
    connections,
    defaultSelection: {
      provider: defaultConnection.provider,
      model: defaultConnection.model,
    },
  }
}

function availability(
  policy: Policy,
  connection: Connection,
): RunModelError | undefined {
  try {
    enforceModel(policy, connection.provider, connection.model)
  } catch (error) {
    return new RunModelError((error as Error).message, 403)
  }
  if (connection.provider !== 'included' && !connection.apiKey?.trim())
    return new RunModelError(
      'Add an API key in settings to use this provider.',
      409,
    )
  if (
    (connection.provider === 'cloudflare' ||
      connection.provider === 'cf_gateway') &&
    !connection.accountId
  )
    return new RunModelError('Add your Cloudflare account ID in settings.', 409)
  if (connection.provider === 'cf_gateway' && !connection.gatewayId)
    return new RunModelError('Add your Cloudflare Gateway ID in settings.', 409)
  if (connection.provider === 'compatible') {
    try {
      validateEndpoint(connection.baseUrl)
    } catch {
      return new RunModelError(
        'Set a public HTTPS API endpoint in settings.',
        409,
      )
    }
  }
  if (
    nativeModels[connection.provider] &&
    connection.provider !== 'vercel' &&
    connection.provider !== 'openrouter' &&
    !isNative(connection.provider, connection.model)
  )
    return new RunModelError(
      'This model is not supported by the installed provider adapter. Choose another model.',
      409,
    )
}

export async function getRunModelCatalog(
  env: ModelEnvironment,
  scope: ModelScope,
): Promise<RunModelCatalog> {
  const { connections, defaultSelection } = await configuration(env, scope)
  const choices: RunModelChoice[] = []
  for (const [provider, connection] of connections) {
    const models = [
      ...new Set([...(nativeModels[provider] ?? []), connection.model]),
    ]
    if (
      models.length > maxProviderModels ||
      choices.length + models.length > maxCatalogModels
    )
      throw new RunModelError(
        'The installed model catalog exceeds its supported size.',
        503,
      )
    for (const model of models) {
      const selected = { ...connection, model }
      const support = modelAttachmentSupport(selected, env.INCLUDED_MODEL)
      const unavailableReason = availability(scope.policy, selected)?.message
      choices.push({
        selection: { provider, model },
        label:
          scope.fixture && provider === 'included'
            ? 'Local preview'
            : (modelLabels[model] ?? model),
        providerLabel: providerLabels[provider],
        attachments: [
          ...(support.imageTypes.length ? ['image' as const] : []),
          ...(support.pdf ? ['pdf' as const] : []),
        ],
        reasoning: ['default', ...reasoningValues(provider, model)].map(
          (value) => ({ value, label: reasoningLabels[value] ?? value }),
        ),
        ...(unavailableReason ? { unavailableReason } : {}),
      })
    }
  }
  return { defaultSelection, choices }
}

export async function resolveRunModel(
  env: ModelEnvironment,
  scope: ModelScope & { selection?: RunModelSelection },
  currentCredentials?: Credentials | null,
): Promise<{
  selection: RunModelSelection
  connection: Connection
  modelOptions: Record<string, unknown>
}> {
  const { connections, defaultSelection } = await configuration(
    env,
    scope,
    currentCredentials,
  )
  const parsed = runModelSchema.safeParse(
    scope.selection === undefined ? defaultSelection : scope.selection,
  )
  if (!parsed.success)
    throw new RunModelError(
      'Choose a valid provider, model, and reasoning setting.',
    )
  const selection = parsed.data
  if (selection.reasoning === 'default') delete selection.reasoning
  const saved = connections.get(selection.provider)
  if (!saved)
    throw new RunModelError(
      'This provider is no longer connected. Choose another model or reconnect it in settings.',
      409,
    )
  if (selection.provider === 'included' && selection.model !== saved.model)
    throw new RunModelError(
      'The included model has changed. Choose the current included model to continue.',
      409,
    )
  // Custom endpoints expose only their configured model, never an arbitrary client-supplied ID.
  if (!nativeModels[selection.provider] && selection.model !== saved.model)
    throw new RunModelError(
      'This model is no longer configured. Choose another model in settings.',
      409,
    )
  if (
    selection.provider === 'vercel' &&
    !isNative('vercel', selection.model) &&
    selection.model !== saved.model
  )
    throw new RunModelError(
      'This gateway model is not configured. Choose a model from the list.',
      409,
    )
  if (
    selection.provider === 'openrouter' &&
    !isNative('openrouter', selection.model) &&
    selection.model !== saved.model
  )
    throw new RunModelError(
      'This OpenRouter model is not configured. Choose a model from the list.',
      409,
    )
  const connection = { ...saved, model: selection.model }
  const unavailable = availability(scope.policy, connection)
  if (unavailable) throw unavailable
  if (
    selection.reasoning &&
    !reasoningValues(selection.provider, selection.model).includes(
      selection.reasoning,
    )
  )
    throw new RunModelError(
      'This reasoning setting is not supported by the selected provider and model.',
    )
  return { selection, connection, modelOptions: modelOptions(selection) }
}
