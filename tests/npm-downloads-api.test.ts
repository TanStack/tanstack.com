import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readNpmDownloads } from '../src/utils/npm-downloads-api.server'

const payload = {
  packages: ['@tanstack/react-query', '@tanstack/react-query'],
  startDate: '2026-01-01',
  endDate: '2026-02-01',
}

function request(body: unknown) {
  return new Request('https://tanstack.com/api/data/npm-downloads', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

test('delegates unique packages and dates to the shared download loader', async () => {
  const name = '@tanstack/react-query'
  const downloads = [{ day: '2026-01-01', downloads: 123 }]
  const response = await readNpmDownloads(
    request(payload),
    async ({ data }) => {
      assert.deepEqual(data, {
        startDate: payload.startDate,
        endDate: payload.endDate,
        packageGroups: [{ packages: [{ name }] }],
      })
      return [
        {
          packages: [{ name, downloads, hidden: undefined }],
          start: payload.startDate,
          end: payload.endDate,
          error: null,
        },
      ]
    },
  )
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { packages: [{ name, downloads }] })
})

test('rejects malformed or oversized batches before reading the cache', async () => {
  const invalid = [
    { ...payload, packages: ['../invalid'] },
    { ...payload, packages: Array(17).fill('react') },
    { ...payload, startDate: '2024-01-01' },
    { ...payload, endDate: '2099-01-01' },
    { ...payload, startDate: '2026-02-30' },
    { ...payload, padding: 'x'.repeat(8192) },
  ]
  for (const body of invalid) {
    const response = await readNpmDownloads(request(body), async () => {
      assert.fail('invalid requests must not read downloads')
    })
    assert.equal(response.status, 400)
  }
})
