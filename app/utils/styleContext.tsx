import * as React from 'react'
import { virtualSheet, getStyleTagProperties } from 'twind/sheets'
import { setup } from 'twind'
import { sharedTwindConfig } from '../../twind.shared'
import { renderToString } from 'react-dom/server'

const styleContext = React.createContext<string>('')

export function initStyles() {
  // We should only have one instance of the virtual sheet
  if (!global.__sheet) {
    // We'll naively assume that the server is always the same
    // and cache the sheecss by hash here
    global.__cssByHash = {}
    // Create the virtual sheet
    global.__sheet = virtualSheet()
    // Create the twind config
    setup({
      ...sharedTwindConfig,
      sheet: global.__sheet,
    })
  }
}

export function renderWithStyles(children: React.ReactNode) {
  const crypto = require('crypto')
  // Reset the virtual sheet before render
  global.__sheet.reset()
  // Render the app
  renderToString(<>{children}</>)
  // Harvest the styles
  const { textContent } = getStyleTagProperties(global.__sheet)
  // Hash the styles
  const hash = crypto
    .createHash('sha256')
    .update(textContent)
    .digest('hex')
    .substring(0, 10)
  // Store the styles by hash
  global.__cssByHash[hash] = textContent
  // Feed the hash to the app and render again
  return renderToString(
    <styleContext.Provider value={hash}>{children}</styleContext.Provider>
  )
}

export function getStylesByHash(hash: string) {
  return global.__cssByHash[hash]
}

export function useStyles() {
  const hash = React.useContext(styleContext)

  if (!hash) {
    return null
  }

  return <link rel="stylesheet" href={`/api/styles?hash=${hash}`} />
}
