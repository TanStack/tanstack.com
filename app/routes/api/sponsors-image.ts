import type { LoaderArgs } from '@remix-run/node'
import chromium from 'chrome-aws-lambda'
import playwright from 'playwright-core'

export async function loader({ request }: LoaderArgs) {
  const url = new URL(request.url)
  const width = url.searchParams.get('width')
    ? Number(url.searchParams.get('width'))
    : 1200
  const height = url.searchParams.get('height')
    ? Number(url.searchParams.get('height'))
    : 1200

  console.log(await chromium.executablePath)

  // Start the browser with the AWS Lambda wrapper (chrome-aws-lambda)
  const browser = await playwright.chromium.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath,
    headless: chromium.headless,
  })
  // Create a page with the Open Graph image size best practise
  const page = await browser.newPage({
    viewport: {
      width,
      height,
    },
  })

  await page.goto('https://tanstack.com/sponsors-embed', {
    timeout: 15 * 1000,
  })

  const data = await page.screenshot({
    type: 'png',
  })

  await browser.close()

  return new Response(data, {
    headers: {
      'Cache-Control': 'max-age=60, s-maxage=86400, stale-while-revalidate',
      'Content-Type': 'image/png',
    },
  })
}
