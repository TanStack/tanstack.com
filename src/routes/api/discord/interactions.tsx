import { createFileRoute } from '@tanstack/react-router'
import {
  isRecord,
  jsonError,
  jsonResponse,
  readTextBody,
} from '~/utils/api-boundary.server'

const MAX_DISCORD_INTERACTION_BYTES = 64 * 1024
const DISCORD_SIGNATURE_PATTERN = /^[a-f0-9]{128}$/i
const DISCORD_TIMESTAMP_PATTERN = /^\d{1,20}$/
const DISCORD_PUBLIC_KEY_PATTERN = /^[a-f0-9]{64}$/i

const InteractionType = {
  APPLICATION_COMMAND: 2,
  PING: 1,
} as const

const InteractionResponseType = {
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  PONG: 1,
} as const

const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY

type InteractionData = {
  name: string
  options?: Array<{ name: string; value: string }>
}

type Interaction = {
  type: number
  data?: InteractionData
}

function valueToUint8Array(value: string, format?: 'hex') {
  if (format === 'hex') {
    if (!/^[a-f0-9]+$/i.test(value) || value.length % 2 !== 0) {
      throw new Error('Value is not a valid hex string')
    }

    const matches = value.match(/.{1,2}/g)

    if (!matches) {
      throw new Error('Value is not a valid hex string')
    }

    return new Uint8Array(
      matches.map((byte) => Number.parseInt(byte, 16)),
    )
  }

  return new TextEncoder().encode(value)
}

async function verifyDiscordKey(
  rawBody: string,
  signature: string,
  timestamp: string,
  clientPublicKey: string,
) {
  const timestampBytes = valueToUint8Array(timestamp)
  const bodyBytes = valueToUint8Array(rawBody)
  const message = new Uint8Array(timestampBytes.length + bodyBytes.length)
  message.set(timestampBytes)
  message.set(bodyBytes, timestampBytes.length)

  const publicKey = await crypto.subtle.importKey(
    'raw',
    valueToUint8Array(clientPublicKey, 'hex'),
    {
      name: 'Ed25519',
    },
    false,
    ['verify'],
  )

  return crypto.subtle.verify(
    { name: 'Ed25519' },
    publicKey,
    valueToUint8Array(signature, 'hex'),
    message,
  )
}

function handleStatusCommand() {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: '✅ TanStack Bot is online and ready.',
      flags: 64, // Ephemeral (only visible to command user)
    },
  }
}

function handleUnknownCommand(commandName: string) {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `Unknown command: ${commandName}`,
      flags: 64,
    },
  }
}

function parseInteraction(value: unknown): Interaction | null {
  if (!isRecord(value) || typeof value.type !== 'number') {
    return null
  }

  const data = value.data
  if (data === undefined) {
    return { type: value.type }
  }

  if (!isRecord(data) || typeof data.name !== 'string') {
    return null
  }

  const options = data.options
  const parsedOptions: InteractionData['options'] = []
  if (Array.isArray(options)) {
    for (const option of options) {
      if (
        !isRecord(option) ||
        typeof option.name !== 'string' ||
        typeof option.value !== 'string'
      ) {
        return null
      }

      parsedOptions.push({
        name: option.name,
        value: option.value,
      })
    }
  }

  return {
    type: value.type,
    data: {
      name: data.name,
      options: parsedOptions.length > 0 ? parsedOptions : undefined,
    },
  }
}

export const Route = createFileRoute('/api/discord/interactions')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          if (!DISCORD_PUBLIC_KEY) {
            console.error('[Discord] DISCORD_PUBLIC_KEY not configured')
            return jsonError('Discord public key not configured', 500)
          }

          if (!DISCORD_PUBLIC_KEY_PATTERN.test(DISCORD_PUBLIC_KEY)) {
            console.error('[Discord] DISCORD_PUBLIC_KEY is malformed')
            return jsonError('Discord public key is malformed', 500)
          }

          const signature = request.headers.get('X-Signature-Ed25519')
          const timestamp = request.headers.get('X-Signature-Timestamp')

          if (
            !signature ||
            !timestamp ||
            !DISCORD_SIGNATURE_PATTERN.test(signature) ||
            !DISCORD_TIMESTAMP_PATTERN.test(timestamp)
          ) {
            console.error('[Discord] Missing signature headers')
            return jsonError('Missing signature headers', 401)
          }

          const bodyResult = await readTextBody(
            request,
            MAX_DISCORD_INTERACTION_BYTES,
          )
          if (!bodyResult.success) {
            return jsonError(bodyResult.error.message, bodyResult.error.status)
          }
          const body = bodyResult.text

          const isValid = await verifyDiscordKey(
            body,
            signature,
            timestamp,
            DISCORD_PUBLIC_KEY,
          )

          if (!isValid) {
            console.error('[Discord] Invalid signature')
            return jsonError('Invalid signature', 401)
          }

          const interaction = parseInteraction(JSON.parse(body))
          if (!interaction) {
            return jsonError('Invalid interaction payload', 400)
          }

          console.log('[Discord] Interaction type:', interaction.type)

          // Handle PING (Discord uses this to verify endpoint)
          if (interaction.type === InteractionType.PING) {
            console.log('[Discord] Responding to PING')
            return jsonResponse({ type: InteractionResponseType.PONG })
          }

          // Handle slash commands
          if (interaction.type === InteractionType.APPLICATION_COMMAND) {
            const commandName = interaction.data?.name
            console.log('[Discord] Command:', commandName)

            let response
            switch (commandName) {
              case 'tanstack':
                response = handleStatusCommand()
                break
              default:
                response = handleUnknownCommand(commandName || 'unknown')
            }

            return jsonResponse(response)
          }

          console.error('[Discord] Unknown interaction type:', interaction.type)
          return jsonError('Unknown interaction type', 400)
        } catch (error) {
          console.error('[Discord] Handler error:', error)
          return jsonError('Internal server error', 500)
        }
      },
    },
  },
})
