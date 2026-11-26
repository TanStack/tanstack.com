const token = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN
if (!token)
  throw new Error(
    'Set CLOUDFLARE_API_TOKEN with Account Analytics Read permission.',
  )

// Optional ISO timestamps let before/after samples use matching windows.
const end = process.argv[3] ?? new Date().toISOString()
const start =
  process.argv[2] ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: `query($accountTag: string!, $startDate: Time, $endDate: Time) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          r2OperationsAdaptiveGroups(limit: 10000, filter: {
            datetime_geq: $startDate, datetime_leq: $endDate
          }) {
            sum { requests }
            dimensions { bucketName actionType actionStatus }
          }
        }
      }
    }`,
    variables: {
      accountTag: '8da95258a9c70b54c3e2b374a0079106',
      startDate: start,
      endDate: end,
    },
  }),
})
if (!response.ok)
  throw new Error(`Cloudflare analytics returned ${response.status}`)
const result = await response.json()
if (result.errors?.length) throw new Error(JSON.stringify(result.errors))
const buckets = new Set([
  'tanstack-github-content-cache',
  'tanstack-npm-download-cache',
  'tanstack-notebook-projects',
])
const operations = result.data.viewer.accounts.flatMap((account) =>
  account.r2OperationsAdaptiveGroups.filter((operation) =>
    buckets.has(operation.dimensions.bucketName),
  ),
)
console.log(JSON.stringify({ start, end, operations }, null, 2))
