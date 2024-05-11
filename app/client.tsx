/// <reference types="vinxi/types/client" />
import * as React from 'react'
import { hydrateRoot } from 'react-dom/client'
import 'vinxi/client'

import { createRouter } from './router'
import { StartClient } from '@tanstack/start'
import './utils/sentry'

const router = createRouter()

// hydrateRoot(document, <StartClient router={router} />)
hydrateRoot(document.getElementById('root')!, <StartClient router={router} />)
