#!/usr/bin/env node

const crypto = require('crypto')

// Generate a random 32-byte (256-bit) key for AES-256-GCM
const key = crypto.randomBytes(32)
const hexKey = key.toString('hex')

console.log('Generated encryption key for KEY_ENCRYPTION environment variable:')
console.log(hexKey)
console.log('')
console.log('Add this to your .env file:')
console.log(`KEY_ENCRYPTION=${hexKey}`)
console.log('')
console.log(
  '⚠️  IMPORTANT: Keep this key secure and never commit it to version control!'
)
