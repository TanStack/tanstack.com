/// <reference types="vinxi/types/client" />
import { hydrateRoot, createRoot } from 'react-dom/client'
import 'vinxi/client'

import { createRouter } from './router'
import { StartClient } from '@tanstack/react-router-server'

const router = createRouter()

const app = <StartClient router={router} />

router.hydrate()

const handler = (errorArgs: string[]) => {
  const err =
    typeof errorArgs[0] === 'string'
      ? interpolate(errorArgs[0], errorArgs.slice(1))
      : errorArgs[0]

  if (
    err.includes('Minified React error #418') ||
    err.includes('Minified React error #422') ||
    err.includes('did not match. Server:') ||
    err.includes('Did not expect server HTML to contain') ||
    err.includes('Failed to execute') ||
    err.includes('Expected server HTML to contain')
  ) {
    console.error(
      'The following errors occurred while hydrating the app, likely due to browser extensions mutating the dom before hydration. Falling back to client-side rendering.'
    )
    createRoot(document as any).render(app)
  }
}

// Patch console.error and console.warn to catch errors
const originalError = console.error
const originalWarn = console.warn
console.error = function (...args: any[]) {
  handler(args)
  originalError(...args)
}
console.warn = function (...args: any[]) {
  handler(args)
  originalWarn(...args)
}

try {
  hydrateRoot(document, app)
} catch (e) {
  console.error(e)
  createRoot(document as any).render(app)
}

function interpolate(template: string, values: string[] = []) {
  let index = 0
  return template.replace(/%s/g, () => values[index++] || '')
}
