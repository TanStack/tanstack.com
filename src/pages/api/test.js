import { middleware } from '../../server/middleware'

export default async function handler(req, res) {
  // Run the middleware
  await middleware(req, res)

  console.log('hello')

  // Get data from your database
  res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate')

  res.status(200).json({
    message: Date.now(),
  })
}
