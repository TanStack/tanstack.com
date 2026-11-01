import type { CatalogEntry } from './mcp-catalog'

/** Keep source identity when projecting a catalog entry into inference evidence. */
export function describeCatalogEntry(entry: CatalogEntry) {
  return {
    id: entry.id,
    serverId: entry.serverId,
    serverLabel: entry.serverLabel,
    kind: entry.kind,
    name: entry.name,
    title: entry.title,
    description: entry.description,
  }
}

/** Host catalog provenance, separate from untrusted result payloads. */
export function catalogEntrySource(entry: CatalogEntry) {
  return {
    serverId: entry.serverId,
    serverLabel: entry.serverLabel,
    kind: entry.kind,
  }
}
