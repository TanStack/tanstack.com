import assert from 'node:assert/strict'
import { getForgeDownloadErrorResponse } from '../src/utils/forge-download'

assert.deepEqual(
  getForgeDownloadErrorResponse(
    new Error('Forge has no manifest to download.'),
  ),
  {
    body: {
      details: 'Forge has no manifest to download.',
      error: 'Forge manifest not found.',
    },
    status: 404,
  },
  'download without a manifest should be a not-found response',
)

const missingManifestFile = getForgeDownloadErrorResponse(
  new Error(
    "ENOENT: no such file or directory, open '/tmp/session/manifests/local-manifest.json'",
  ),
)

assert.equal(
  missingManifestFile.status,
  404,
  'missing manifest file should be a not-found response',
)
assert.equal(missingManifestFile.body.error, 'Forge manifest not found.')

const missingBlobFile = getForgeDownloadErrorResponse(
  new Error(
    "ENOENT: no such file or directory, open '/tmp/session/blobs/local-file.json'",
  ),
)

assert.equal(
  missingBlobFile.status,
  500,
  'missing manifest blob should remain an internal integrity failure',
)
assert.equal(missingBlobFile.body.error, 'Failed to download Forge manifest.')

console.log('Forge download error verifier passed')
