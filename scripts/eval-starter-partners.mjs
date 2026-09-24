import assert from 'node:assert/strict'

// Run against a preview with live Jev credentials, not the mocked unit-test adapter.
// node scripts/eval-starter-partners.mjs https://your-preview.workers.dev
const endpoint = new URL('/api/application-starter/resolve', process.argv[2])
const hosting = ['cloudflare', 'netlify', 'railway', 'render', 'vercel']
const cases = [
  {
    input: 'I want to build a SaaS application',
    required: [['clerk', 'workos'], ['prisma'], hosting],
  },
  { input: 'I want to build a recipe app', required: [['prisma'], hosting] },
  { input: 'I want to build a blog', required: [hosting] },
  {
    input: 'I want to build a resume',
    required: [hosting],
    excluded: ['clerk', 'workos', 'prisma', 'openrouter'],
  },
  {
    input: 'Use Supabase for auth and storage',
    required: [],
    excluded: ['clerk', 'workos', 'prisma'],
  },
  { input: 'hello there', required: [], empty: true },
]
let failures = 0
for (const scenario of cases) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: scenario.input,
        context: 'home',
        mode: 'analyze',
      }),
    })
    assert.equal(response.status, 200)
    const { partnerIntent } = await response.json()
    const eligible = partnerIntent?.eligiblePartnerIds ?? []
    for (const group of scenario.required) {
      assert(
        group.some((id) => eligible.includes(id)),
        `Missing category: ${group.join(', ')}`,
      )
    }
    for (const id of scenario.excluded ?? [])
      assert(!eligible.includes(id), `Unexpected service: ${id}`)
    if (scenario.empty) assert.equal(eligible.length, 0)
    console.log('PASS', scenario.input, eligible)
  } catch (error) {
    failures++
    console.error('FAIL', scenario.input, error.message)
  }
}
process.exitCode = failures ? 1 : 0
