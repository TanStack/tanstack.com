// These are authored source facts, never cache or request timestamps.
export function readDocsFreshness(frontmatter: Record<string, unknown>) {
  const updated = readDate(frontmatter.updated)
  const testedWith = frontmatter.testedWith
  const packages =
    typeof testedWith === 'object' &&
    testedWith !== null &&
    !Array.isArray(testedWith)
      ? Object.entries(testedWith).flatMap(([name, version]) =>
          /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(name) &&
          typeof version === 'string' &&
          /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(
            version,
          )
            ? [{ name, version }]
            : [],
        )
      : []
  return { updated, packages }
}

function readDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return undefined
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== value
  )
    return undefined
  return value
}
