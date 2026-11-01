import { and, eq } from 'drizzle-orm'
import { db, isDatabaseConfigured } from '~/db/client'
import { showcases } from '~/db/schema'

export async function getShowcaseSitemapEntries() {
  if (process.env.NODE_ENV === 'development' && !(await isDatabaseConfigured()))
    return []

  const projects = await db
    .select({ id: showcases.id })
    .from(showcases)
    .where(
      and(
        eq(showcases.status, 'approved'),
        eq(showcases.placement, 'showcase'),
      ),
    )

  return projects.map(({ id }) => ({ path: `/showcase/${id}` }))
}
