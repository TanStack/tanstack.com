/// <reference types="vinxi/types/server" />
import { PipeableStream, renderToPipeableStream } from 'react-dom/server'
import { eventHandler, setHeader, toWebRequest } from 'vinxi/server'
import { getManifest } from 'vinxi/manifest'
import {
  StartServer,
  transformStreamWithRouter,
} from '@tanstack/react-router-server/server'
import { Transform, PassThrough } from 'stream'

import { routeTree } from './routeTree.gen'
import { createMemoryHistory, createRouter } from '@tanstack/react-router'
import { DefaultCatchBoundary } from './components/DefaultCatchBoundary'

export default eventHandler(async (event) => {
  const req = toWebRequest(event)
  const url = new URL(req.url)
  const href = url.href.replace(url.origin, '')

  // Get assets for the server/client
  const clientManifest = getManifest('client')
  let assets = (
    await clientManifest.inputs[clientManifest.handler].assets()
  ).filter((d: any) => {
    return !d.children?.includes('nuxt-devtools')
  }) as any

  assets.push(
    {
      tag: 'script',
      attrs: {},
      children: getHydrationOverlayScriptContext(),
    },
    {
      tag: 'script',
      children: `window.__vite_plugin_react_preamble_installed__ = true`,
    },
    {
      tag: 'script',
      attrs: {
        src: clientManifest.inputs[clientManifest.handler].output.path,
        type: 'module',
        async: true,
      },
    }
  )

  // Create a router
  const router = createRouter({
    routeTree,
    defaultPreload: 'intent',
    defaultErrorComponent: DefaultCatchBoundary,
    context: {
      assets: [],
    },
  })

  // Create a history for the router
  const history = createMemoryHistory({
    initialEntries: [href],
  })

  // Update the router with the history and context
  router.update({
    history,
    context: {
      assets,
    },
  })

  // Load critical data for the router
  await router.load()

  const stream = await new Promise<PipeableStream>(async (resolve) => {
    const stream = renderToPipeableStream(<StartServer router={router} />, {
      onShellReady() {
        resolve(stream)
      },
    })
  })

  // Add our Router transform to the stream
  const transforms = [
    transformStreamWithRouter(router),
    // A transform that logs chunks
    // new Transform({
    //   transform(chunk, encoding, callback) {
    //     const str = chunk.toString()
    //     console.log('')
    //     console.log('CHUNK')
    //     console.log('')
    //     console.log(str)
    //     this.push(str)
    //     return callback()
    //   },
    // }),
  ]

  // Pipe the stream through our transforms
  const transformedStream = transforms.reduce(
    (stream, transform) => stream.pipe(transform as any),
    stream
  )

  const headers = router.state.matches.reduce((acc, match) => {
    if (match.headers) {
      Object.assign(acc, match.headers)
    }
    return acc
  }, {})

  const routerStatus = router.state.matches.some(
    (match) => match.status === 'error'
  )
    ? 500
    : 200

  return new Response(transformedStream as any, {
    status: routerStatus,
    statusText: routerStatus === 200 ? 'OK' : 'Internal Server Error',
    headers: {
      'Content-Type': 'text/html',
      ...headers,
    },
  })
})

function getHydrationOverlayScriptContext() {
  return `
window.BUILDER_HYDRATION_OVERLAY = {}

const selector = 'html'

const handleError = () => {
  window.BUILDER_HYDRATION_OVERLAY.ERROR = true
  let appRootEl = document.querySelector(selector)

  if (appRootEl && !window.BUILDER_HYDRATION_OVERLAY.CSR_HTML) {
    window.BUILDER_HYDRATION_OVERLAY.CSR_HTML = appRootEl.innerHTML
  }
}

const proxyConsole = (method) => {
  const original = console[method]

  console[method] = function () {
    const msg = arguments[0]?.message?.toLowerCase()
    if (msg && (msg.includes('hydration') || msg.includes('hydrating'))) {
      handleError()
    }
    original.apply(console, arguments)
  }
}

const methods = ['log', 'error', 'warn']
methods.forEach(proxyConsole)

window.addEventListener('error', (event) => {
  const msg = event.message.toLowerCase()
  const isHydrationMsg = msg.includes('hydration') || msg.includes('hydrating')

  if (isHydrationMsg) {
    handleError()
  }
})

let BUILDER_HYDRATION_OVERLAY_ELEMENT = document.querySelector(selector)
if (BUILDER_HYDRATION_OVERLAY_ELEMENT) {
window.BUILDER_HYDRATION_OVERLAY.SSR_HTML =
BUILDER_HYDRATION_OVERLAY_ELEMENT.innerHTML
}
`
}
