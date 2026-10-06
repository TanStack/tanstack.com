export type SetupLinks = Array<{ ref: string; urls: string[] }>
const publicUrl = (url: URL) =>
  url.protocol === 'https:' &&
  !url.username &&
  !url.password &&
  !url.hash &&
  ![...url.searchParams.keys()].some((key) =>
    /^(access_token|refresh_token|client_secret|password|code|api_key)$/i.test(
      key,
    ),
  )

/** Retain URLs from tool evidence, never credentials or complete source documents. */
export class SetupEvidence {
  private evidence = new Map<string, string[]>()
  constructor(
    saved: SetupLinks = [],
    private changed?: (links: SetupLinks) => void,
  ) {
    for (const entry of saved) this.evidence.set(entry.ref, entry.urls)
  }
  snapshot(): SetupLinks {
    return [...this.evidence].map(([ref, urls]) => ({ ref, urls: [...urls] }))
  }
  register(ref: string, value: unknown, origin?: string) {
    const strings: string[] = []
    const explicitLinks: string[] = []
    const collect = (part: unknown, key?: string) => {
      if (typeof part === 'string') strings.push(part)
      else if (Array.isArray(part)) part.forEach((item) => collect(item))
      else if (part && typeof part === 'object')
        for (const [name, item] of Object.entries(part)) collect(item, name)
      if (
        origin &&
        typeof part === 'string' &&
        /(?:url|href)$/i.test(key ?? '') &&
        part.startsWith('/') &&
        !part.startsWith('//')
      )
        explicitLinks.push(part)
    }
    collect(value)
    const urls = new Set<string>()
    for (const text of strings) {
      for (const candidate of text.match(/https:\/\/[^\s<>"'`]+/g) ?? []) {
        try {
          const url = new URL(candidate.replace(/[.,;)]+$/, ''))
          if (publicUrl(url)) urls.add(url.href)
        } catch {
          /* Invalid or unsafe URLs are not evidence. */
        }
      }
    }
    for (const candidate of explicitLinks) {
      try {
        const url = new URL(candidate, origin)
        if (publicUrl(url)) urls.add(url.href)
      } catch {
        /* Invalid structured links are not evidence. */
      }
    }
    this.evidence.set(ref, [...urls])
    // Bound persisted discovery metadata. Older evidence can be inspected again.
    while (JSON.stringify(this.snapshot()).length > 128000) {
      this.evidence.delete(this.evidence.keys().next().value!)
    }
    this.changed?.(this.snapshot())
  }
  forget(ref: string) {
    this.evidence.delete(ref)
    this.changed?.(this.snapshot())
  }
  resolve(evidenceRef: string, raw: string) {
    const evidence = this.evidence.get(evidenceRef)
    if (!evidence)
      throw new Error(
        'Inspect setup documentation before requesting a user step.',
      )
    const url = new URL(raw)
    if (!publicUrl(url))
      throw new Error('Use a public HTTPS setup link without credentials.')
    if (!evidence.includes(url.href))
      throw new Error(
        `The setup link must come from the inspected documentation. Documented URLs for this reference: ${JSON.stringify(evidence.slice(0, 20))}. Use an exact listed URL, or inspect the source containing the desired URL.`,
      )
    return url.href
  }
}
