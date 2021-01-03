import * as playwright from 'playwright-aws-lambda'
import { middleware } from '../../server/middleware'

export default async function handler(req, res) {
  // Run the middleware
  await middleware(req, res)

  console.log('testing...')

  const browser = await playwright.launchChromium()
  const page = await browser.newPage()
  await page.goto('http://whatsmyuseragent.org/')
  const imageBuf = await page.screenshot()
  await browser.close()

  res.setHeader('Content-Disposition', 'attachment; filename=screenshot.png')

  // Get data from your database
  res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate')

  res.send(imageBuf)

  // res.status(200).json({
  //   message: Date.now(),
  // })
}
