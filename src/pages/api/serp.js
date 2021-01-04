import { devices } from 'playwright-core'

import { middleware } from '../../server/middleware'
import { makeBrowser } from '../../utils/Browser'

const iPhone11Pro = devices['iPhone 11 Pro']
const maxAge = 60 * 5 // 5 minutes

export default async function handler(req, res) {
  // Run the middleware
  await middleware(req, res)

  const { phrase } = req.query

  const browser = await makeBrowser({
    headless: process.env.NODE_ENV === 'development' ? false : true,
  })

  const context = await browser.newContext({
    ...iPhone11Pro,
  })

  const page = await context.newPage()

  // locale: 'en-US',
  // geolocation: { longitude: 12.492507, latitude: 41.889938 },
  // permissions: ['geolocation'],
  // context.setGeolocation({latitude: 59.95, longitude: 30.31667});

  await page.goto(`https://www.google.com/search?q=${phrase}&num=100`)
  const imageBuf = await page.screenshot({ type: 'png', fullPage: true })
  await context.close()

  // Get data from your database
  res.setHeader('Content-Disposition', 'attachment; filename=screenshot.png')

  res.setHeader('Cache-Control', `s-maxage=${maxAge}, stale-while-revalidate`)
  res.send(imageBuf)

  // res.status(200).json({
  //   message: Date.now(),
  // })
}
