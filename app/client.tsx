/// <reference types="vinxi/types/client" />
import { hydrateRoot, createRoot } from 'react-dom/client'
import 'vinxi/client'

import { createRouter } from './router'
import { StartClient } from '@tanstack/react-router-server'

const router = createRouter()

const app = <StartClient router={router} />

router.hydrate()

const handler = (error?: any) => {
  const errStr = String(error?.message || error)
  if (
    errStr.includes('Minified React error #418') ||
    errStr.includes('Did not expect server HTML to contain') ||
    errStr.includes('Expected server HTML to contain')
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
  handler(args[0])
  originalError(...args)
}
console.warn = function (...args: any[]) {
  handler(args[0])
  originalWarn(...args)
}

try {
  hydrateRoot(document, app)
} catch (e) {
  console.error(e)
  createRoot(document as any).render(app)
}
