import { chromium } from 'playwright-chromium'
import * as playwright from 'playwright-aws-lambda'

export async function makeBrowser(options) {
  if (process.env.NODE_ENV === 'development') {
    return await chromium.launch(options)
  } else {
    return await playwright.launchChromium(options)
  }
}
