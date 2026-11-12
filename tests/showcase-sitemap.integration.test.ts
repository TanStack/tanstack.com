import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { build } from 'esbuild'
import postgres from 'postgres'
import { SHOWCASE_STATUSES, SHOWCASE_PLACEMENTS } from '../src/db/types'

const databaseUrl = process.env.SHOWCASE_SITEMAP_TEST_DATABASE_URL

test(
  'sitemap includes only approved curated showcases from the database',
  { skip: !databaseUrl },
  async () => {
    assert.ok(databaseUrl)
    const url = new URL(databaseUrl)
    assert.equal(url.hostname, '127.0.0.1')
    assert.match(url.pathname, /^\/watch_sitemap_/)
    const sql = postgres(databaseUrl, { max: 1 })
    await mkdir('node_modules/.cache', { recursive: true })
    const directory = await mkdtemp(
      resolve('node_modules/.cache/sitemap-test-'),
    )
    let createdTable = false
    let closeDatabase: (() => Promise<void>) | undefined
    try {
      await sql`CREATE TABLE showcases (id uuid PRIMARY KEY, status text NOT NULL, placement text NOT NULL)`
      createdTable = true
      let expectedId = ''
      for (const status of SHOWCASE_STATUSES) {
        for (const placement of SHOWCASE_PLACEMENTS) {
          const id = randomUUID()
          await sql`INSERT INTO showcases VALUES (${id}, ${status}, ${placement})`
          if (status === 'approved' && placement === 'showcase') expectedId = id
        }
      }
      const output = join(directory, 'query.mjs')
      await build({
        stdin: {
          contents: `export { getShowcaseSitemapEntries } from './src/utils/showcase-sitemap.server'; export { closeDatabase } from 'fixture:db';`,
          resolveDir: process.cwd(),
          loader: 'ts',
        },
        outfile: output,
        bundle: true,
        platform: 'node',
        format: 'esm',
        packages: 'external',
        plugins: [
          {
            name: 'isolated-local-database',
            setup(builder) {
              builder.onResolve(
                { filter: /^(~\/db\/client|fixture:db)$/ },
                () => ({ path: 'db', namespace: 'fixture' }),
              )
              builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
                contents: `import postgres from 'postgres'; import { drizzle } from 'drizzle-orm/postgres-js'; const client = postgres(process.env.SHOWCASE_SITEMAP_TEST_DATABASE_URL, { max: 1 }); export const db = drizzle(client); export const isDatabaseConfigured = async () => true; export const closeDatabase = () => client.end();`,
                loader: 'js',
                resolveDir: process.cwd(),
              }))
            },
          },
        ],
      })
      const query = await import(pathToFileURL(output).href)
      closeDatabase = query.closeDatabase
      assert.deepEqual(await query.getShowcaseSitemapEntries(), [
        { path: `/showcase/${expectedId}` },
      ])
      await sql`UPDATE showcases SET placement = 'private' WHERE id = ${expectedId}`
      assert.deepEqual(await query.getShowcaseSitemapEntries(), [])
    } finally {
      await closeDatabase?.()
      if (createdTable) await sql`DROP TABLE showcases`
      await sql.end()
      await rm(directory, { recursive: true, force: true })
    }
  },
)
