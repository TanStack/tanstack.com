/// <reference types="vinxi/types/client" />
import * as React from 'react'
import { hydrateRoot } from 'react-dom/client'
import 'vinxi/client'

import { createRouter } from './router'
import { StartClient } from '@tanstack/react-router-server'

const router = createRouter()

const app = <StartClient router={router} />

router.hydrate()

React.startTransition(() => {
  hydrateRoot(document.getElementById('root')!, app)
})
