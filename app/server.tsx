/// <reference types="vinxi/types/server" />
import { renderAsset } from '@vinxi/react'
import React, { Suspense } from 'react'
import { PipeableStream, renderToPipeableStream } from 'react-dom/server'
import { eventHandler, setHeader, toWebRequest } from 'vinxi/server'
import {
  StartServer,
  transformStreamWithRouter,
} from '@tanstack/react-router-server/server'

import { createRouter } from './router'
import { createMemoryHistory } from '@tanstack/react-router'

export default eventHandler(async (event) => {
  const req = toWebRequest(event)
  const url = new URL(req.url)
  const href = url.href.replace(url.origin, '')

  // Get assets for the server/client
  const clientManifest = import.meta.env.MANIFEST['client']
  const assets = await clientManifest.inputs[clientManifest.handler].assets()

  // Create a router
  const router = createRouter()
  // Create a history for the router
  const history = createMemoryHistory({
    initialEntries: [href],
  })
  // Update the router with the history and context
  router.update({
    history,
    context: {
      assets: <Suspense>{assets.map((m) => renderAsset(m))}</Suspense>,
    },
  })

  // Load critical data for the router
  await router.load()

  const stream = await new Promise<PipeableStream>(async (resolve) => {
    const stream = renderToPipeableStream(<StartServer router={router} />, {
      onShellReady() {
        resolve(stream)
      },
      bootstrapModules: [
        clientManifest.inputs[clientManifest.handler].output.path,
      ],
      bootstrapScriptContent: `window.manifest = ${JSON.stringify(
        await clientManifest.json()
      )}`,
    })
  })

  setHeader(event, 'Content-Type', 'text/html')

  // Add our Router transform to the stream
  const transforms = [transformStreamWithRouter(router)]

  // Pipe the stream through our transforms
  const transformedStream = transforms.reduce(
    (stream, transform) => stream.pipe(transform as any),
    stream
  )

  // Pipe the transformed stream to the response
  return transformedStream
})
