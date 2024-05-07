/// <reference types="vinxi/types/client" />
import * as React from 'react'
import { hydrateRoot } from 'react-dom/client'
import 'vinxi/client'

import { createRouter } from './router'
import { StartClient } from '@tanstack/react-router-server'

const router = createRouter()

React.startTransition(() => {
  hydrateRoot(document.getElementById('root')!, <StartClient router={router} />)
})
