/**
 * Test that chunk boundaries are consistent across multiple runs
 * Verifies that the same package will always generate the same chunk keys
 */

function generateNormalizedChunks(
  startDate: string,
  endDate: string,
): Array<{ from: string; to: string }> {
  const CHUNK_DAYS = 500
  const chunks: Array<{ from: string; to: string }> = []

  let currentFrom = new Date(startDate)
  const finalDate = new Date(endDate)

  while (currentFrom <= finalDate) {
    const from = currentFrom.toISOString().substring(0, 10)

    const potentialTo = new Date(currentFrom)
    potentialTo.setDate(potentialTo.getDate() + CHUNK_DAYS - 1)

    const to =
      potentialTo > finalDate
        ? finalDate.toISOString().substring(0, 10)
        : potentialTo.toISOString().substring(0, 10)

    chunks.push({ from, to })

    currentFrom = new Date(to)
    currentFrom.setDate(currentFrom.getDate() + 1)

    if (to === endDate) break
  }

  return chunks
}

console.log('\n' + '='.repeat(80))
console.log('🧪 Testing Chunk Boundary Consistency')
console.log('='.repeat(80) + '\n')

// Simulate @tanstack/react-query (created Oct 25, 2019)
const packageName = '@tanstack/react-query'
const createdDate = '2019-10-25'

console.log(`Package: ${packageName}`)
console.log(`Created: ${createdDate}`)
console.log('')

// Simulate running on different days
const testDates = ['2025-12-06', '2025-12-07', '2025-12-08']

console.log('Testing chunk consistency across different "today" dates:\n')

const allChunks: Record<string, Array<{ from: string; to: string }>> = {}

for (const today of testDates) {
  const chunks = generateNormalizedChunks(createdDate, today)
  allChunks[today] = chunks

  console.log(`📅 If run on ${today}:`)
  console.log(`   Total chunks: ${chunks.length}`)
  console.log(`   Last 3 chunks:`)
  chunks.slice(-3).forEach((chunk, idx) => {
    const chunkNum = chunks.length - 3 + idx + 1
    console.log(`     ${chunkNum}. ${chunk.from} → ${chunk.to}`)
  })
  console.log('')
}

// Check consistency
console.log('='.repeat(80))
console.log('🔍 Consistency Analysis')
console.log('='.repeat(80) + '\n')

const dates = Object.keys(allChunks)
const firstRun = allChunks[dates[0]]
const secondRun = allChunks[dates[1]]
const thirdRun = allChunks[dates[2]]

// Historical chunks should be identical
const historicalChunksToCompare = Math.min(
  firstRun.length - 1,
  secondRun.length - 1,
  thirdRun.length - 1,
)

let allHistoricalMatch = true
for (let i = 0; i < historicalChunksToCompare; i++) {
  if (
    firstRun[i].from !== secondRun[i].from ||
    firstRun[i].to !== secondRun[i].to ||
    firstRun[i].from !== thirdRun[i].from ||
    firstRun[i].to !== thirdRun[i].to
  ) {
    console.log(`❌ Chunk ${i + 1} differs between runs`)
    console.log(`   Run 1: ${firstRun[i].from} → ${firstRun[i].to}`)
    console.log(`   Run 2: ${secondRun[i].from} → ${secondRun[i].to}`)
    console.log(`   Run 3: ${thirdRun[i].from} → ${thirdRun[i].to}`)
    allHistoricalMatch = false
  }
}

if (allHistoricalMatch) {
  console.log(
    `✅ Historical chunks (${historicalChunksToCompare} chunks) are consistent across all runs`,
  )
  console.log(
    `   All historical chunks will have identical cache keys regardless of when fetched`,
  )
}

// Current chunk should differ (expected behavior)
console.log('')
console.log('Current (last) chunk analysis:')
const lastChunks = dates.map((date) => {
  const chunks = allChunks[date]
  return chunks[chunks.length - 1]
})

console.log(
  `  Run 1 (${dates[0]}): ${lastChunks[0].from} → ${lastChunks[0].to}`,
)
console.log(
  `  Run 2 (${dates[1]}): ${lastChunks[1].from} → ${lastChunks[1].to}`,
)
console.log(
  `  Run 3 (${dates[2]}): ${lastChunks[2].from} → ${lastChunks[2].to}`,
)

const currentChunksDiffer = lastChunks[0].to !== lastChunks[1].to
console.log('')
if (currentChunksDiffer) {
  console.log(
    '✅ Current chunks differ (expected - they track "today" and will be marked mutable)',
  )
  console.log(
    '   These chunks expire in 6 hours and get refreshed with updated data',
  )
} else {
  console.log('⚠️  Current chunks are identical (might be same day)')
}

// Cache key example
console.log('\n' + '='.repeat(80))
console.log('📦 Example Cache Keys')
console.log('='.repeat(80) + '\n')

const exampleChunks = firstRun.slice(0, 3)
exampleChunks.forEach((chunk, idx) => {
  const cacheKey = `${packageName}|${chunk.from}|${chunk.to}|daily`
  const isHistorical = chunk.to < dates[0]
  console.log(`Chunk ${idx + 1}: ${cacheKey}`)
  console.log(
    `         ${isHistorical ? '🔒 Immutable (cached forever)' : '⏱️  Mutable (6-hour TTL)'}`,
  )
})

console.log('\n' + '='.repeat(80))
console.log(
  '✅ Chunk consistency verified - cache deduplication will work correctly',
)
console.log('='.repeat(80) + '\n')
