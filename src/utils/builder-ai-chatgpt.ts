export type BuilderChatGptModel = {
  id: string
  label: string
  isDefault: boolean
}

export type BuilderChatGptConnection = {
  connected: boolean
  email?: string
  planType?: string
  models: Array<BuilderChatGptModel>
}

export type BuilderChatGptLogin = {
  loginId: string
  verificationUrl: string
  userCode: string
}

export function parseBuilderChatGptConnection(
  value: unknown,
): BuilderChatGptConnection {
  if (
    !isRecord(value) ||
    typeof value.connected !== 'boolean' ||
    !Array.isArray(value.models) ||
    !value.models.every(isBuilderChatGptModel) ||
    (value.email !== undefined && typeof value.email !== 'string') ||
    (value.planType !== undefined && typeof value.planType !== 'string')
  ) {
    throw new Error('OpenAI returned an invalid connection response')
  }

  return {
    connected: value.connected,
    models: value.models,
    ...(value.email ? { email: value.email } : {}),
    ...(value.planType ? { planType: value.planType } : {}),
  }
}

export function parseBuilderChatGptLogin(value: unknown): BuilderChatGptLogin {
  if (
    !isRecord(value) ||
    typeof value.loginId !== 'string' ||
    !value.loginId ||
    typeof value.verificationUrl !== 'string' ||
    !isOpenAiLoginUrl(value.verificationUrl) ||
    typeof value.userCode !== 'string' ||
    !value.userCode
  ) {
    throw new Error('OpenAI returned an invalid login response')
  }

  return {
    loginId: value.loginId,
    verificationUrl: value.verificationUrl,
    userCode: value.userCode,
  }
}

function isBuilderChatGptModel(value: unknown): value is BuilderChatGptModel {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    Boolean(value.id) &&
    typeof value.label === 'string' &&
    Boolean(value.label) &&
    typeof value.isDefault === 'boolean'
  )
}

function isOpenAiLoginUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'auth.openai.com'
  } catch {
    return false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
