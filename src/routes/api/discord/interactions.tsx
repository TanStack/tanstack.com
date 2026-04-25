import { createFileRoute } from '@tanstack/react-router'

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

export const Route = createFileRoute('/api/discord/interactions')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          if (!DISCORD_PUBLIC_KEY) {
            console.error('[Discord] DISCORD_PUBLIC_KEY not configured')
            return new Response(
              JSON.stringify({ error: 'Discord public key not configured' }),
              { status: 500, headers: { 'Content-Type': 'application/json' } },
            )
          }

          const signature = request.headers.get('X-Signature-Ed25519')
          const timestamp = request.headers.get('X-Signature-Timestamp')

          if (!signature || !timestamp) {
            console.error('[Discord] Missing signature headers')
            return new Response(
              JSON.stringify({ error: 'Missing signature headers' }),
              { status: 401, headers: { 'Content-Type': 'application/json' } },
            )
          }

          const body = await request.text()

          const isValid = await verifyDiscordKey(
            body,
            signature,
            timestamp,
            DISCORD_PUBLIC_KEY,
          )

          if (!isValid) {
            console.error('[Discord] Invalid signature')
            return new Response(
              JSON.stringify({ error: 'Invalid signature' }),
              { status: 401, headers: { 'Content-Type': 'application/json' } },
            )
          }

          const interaction: Interaction = JSON.parse(body)
          console.log('[Discord] Interaction type:', interaction.type)

          // Handle PING (Discord uses this to verify endpoint)
          if (interaction.type === InteractionType.PING) {
            console.log('[Discord] Responding to PING')
            return new Response(
              JSON.stringify({ type: InteractionResponseType.PONG }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            )
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

            return new Response(JSON.stringify(response), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          console.error('[Discord] Unknown interaction type:', interaction.type)
          return new Response(
            JSON.stringify({ error: 'Unknown interaction type' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        } catch (error) {
          console.error('[Discord] Handler error:', error)
          return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          )
        }
      },
    },
  },
})
