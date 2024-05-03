/// <reference types="vinxi/types/client" />
import * as React from 'react'
import { hydrateRoot, createRoot } from 'react-dom/client'
import 'vinxi/client'

import { createRouter } from './router'
import { StartClient } from '@tanstack/react-router-server'

const router = createRouter()

const app = <StartClient router={router} />

router.hydrate()

let root: ReturnType<typeof createRoot>

React.startTransition(() => {
  root = hydrateRoot(document, app)
})

// This is a workaround for react hydration completely barfing when
// browser extensions mutate the DOM before hydration
// This is a temporary solution until React fixes this issue
const checker = setInterval(() => {
  if (!document.documentElement) {
    console.warn(
      'We detected that browser extensions mutated the DOM before hydration and caused some hydration errors. Falling back to client-side rendering.'
    )
    clearInterval(checker)
    clearTimeout(checkedOut)
    // const htmlEl = document.createElement('html')
    // htmlEl.innerHTML = '<head></head><body></body>'
    // document.replaceChildren(htmlEl)
    root.render(app)
  }
}, 1)

const checkedOut = setTimeout(() => {
  clearInterval(checker)
}, 1000)
