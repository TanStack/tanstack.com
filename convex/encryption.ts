// Encryption utilities using Web Crypto API
const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 32

// Helper function to convert hex string to Uint8Array
function hexToUint8Array(hex: string): Uint8Array {
  const buffer = new ArrayBuffer(hex.length / 2)
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes as Uint8Array
}

// Helper function to convert Uint8Array to hex string
function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const keyEnv = process.env.KEY_ENCRYPTION
  if (!keyEnv) {
    throw new Error('KEY_ENCRYPTION environment variable is required')
  }

  // Ensure the key is exactly 32 bytes (64 hex characters)
  if (keyEnv.length !== KEY_LENGTH * 2) {
    throw new Error(
      `KEY_ENCRYPTION must be exactly ${
        KEY_LENGTH * 2
      } hex characters (${KEY_LENGTH} bytes)`
    )
  }

  const keyBytes = hexToUint8Array(keyEnv)

  return await crypto.subtle.importKey(
    'raw',
    keyBytes as BufferSource,
    { name: ALGORITHM },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptApiKey(apiKey: string): Promise<string> {
  const key = await getEncryptionKey()
  const ivBuffer = new ArrayBuffer(12)
  const iv = crypto.getRandomValues(new Uint8Array(ivBuffer)) // 12 bytes for GCM
  const encoder = new TextEncoder()
  const data = encoder.encode(apiKey)

  const encrypted = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv: iv,
    },
    key,
    data
  )

  const encryptedArray = new Uint8Array(encrypted)

  // Return iv + encrypted data, all hex encoded
  return uint8ArrayToHex(iv) + ':' + uint8ArrayToHex(encryptedArray)
}

export async function decryptApiKey(encryptedData: string): Promise<string> {
  const key = await getEncryptionKey()
  const parts = encryptedData.split(':')

  if (parts.length !== 2) {
    throw new Error('Invalid encrypted data format')
  }

  const iv = hexToUint8Array(parts[0])
  const encrypted = hexToUint8Array(parts[1])

  const decrypted = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv: iv as BufferSource,
    },
    key,
    encrypted as BufferSource
  )

  const decoder = new TextDecoder()
  return decoder.decode(decrypted)
}
