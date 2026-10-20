import type { BotViewRow } from '../core/bot-views'

export type SidebarDensity = 'comfortable' | 'compact'

export function sidebarDensityKey(viewerId?: string) {
  return viewerId
    ? JSON.stringify(['gum', 'sidebar-density', 1, viewerId])
    : null
}

/** Collapse branches without hiding roots promoted by a filter or group. */
export function visibleBotRows(
  rows: BotViewRow[],
  expandedIds: ReadonlySet<string>,
  revealAll = false,
) {
  let collapsedDepth: number | undefined
  return rows.flatMap((row, index) => {
    if (collapsedDepth !== undefined && row.depth > collapsedDepth) return []
    collapsedDepth = undefined
    const hasChildren = (rows[index + 1]?.depth ?? 0) > row.depth
    const expanded = hasChildren && (revealAll || expandedIds.has(row.bot.id))
    if (hasChildren && !expanded) collapsedDepth = row.depth
    return [{ ...row, hasChildren, expanded }]
  })
}

/** Whether each ancestor's branch continues below a visible preorder row. */
export function botTreeBranches(rows: BotViewRow[]) {
  const nextDepth: number[] = []
  const branches: boolean[][] = Array.from({ length: rows.length }, () => [])
  for (let index = rows.length - 1; index >= 0; index--) {
    const depth = Math.min(rows[index].depth, 6)
    branches[index] = Array.from(
      { length: depth },
      (_, level) => nextDepth[level + 1] === level + 1,
    )
    for (let level = depth; level <= 6; level++) nextDepth[level] = depth
  }
  return branches
}

export function botAvatar(id: string) {
  let hash = 0
  for (const character of id)
    hash = (hash * 31 + character.codePointAt(0)!) >>> 0
  // Separate seeded samples keep proportions independent and stable per chat.
  const vary = (seed: number, min: number, max: number) => {
    let value = (hash ^ Math.imul(seed, 0x9e3779b9)) >>> 0
    value = Math.imul(value ^ (value >>> 16), 0x21f0aaad)
    value = Math.imul(value ^ (value >>> 15), 0x735a2d97)
    return min + (((value ^ (value >>> 15)) >>> 0) / 0xffffffff) * (max - min)
  }
  return {
    color: hash % 6,
    hue: vary(9, 0, 360),
    shape: (hash >>> 4) % 6,
    expression: (hash >>> 8) % 5,
    eyes: (hash >>> 12) % 5,
    mouthless: (hash >>> 24) % 5 === 0,
    eyeScale: vary(1, 0.8, 1.35),
    mouthScale: vary(2, 0.7, 1.3),
    eyeSpacing: vary(3, 5.8, 8.2),
    eyeHeight: vary(4, -0.8, 0.8),
    eyeAngle: vary(5, -7, 7),
    mouthHeight: vary(6, -0.5, 1.2),
    mouthAngle: vary(7, -6, 6),
    mouthOffset: vary(8, -0.6, 0.6),
    motion: (hash >>> 10) % 4,
    nose: (hash >>> 20) % 10 === 0 ? 1 + ((hash >>> 16) % 3) : 0,
  }
}
