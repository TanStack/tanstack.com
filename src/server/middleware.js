import Cors from 'cors'

// Initializing the cors middleware
const cors = Cors()

// Helper method to wait for a middleware to execute before continuing
// And to throw an error when an error happens in a middleware
export async function middleware(req, res) {
  await doCors(req, res)
}

async function doCors(req, res) {
  return new Promise((resolve, reject) => {
    cors(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result)
      }

      return resolve(result)
    })
  })
}
