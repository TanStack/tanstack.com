import { Validator } from '@cfworker/json-schema'

export interface GroundedValue {
  id: string
  value: unknown
  source: {
    kind: 'request' | 'observation' | 'schema' | 'assembled'
    id: string
    path: string
  }
  otherSources?: GroundedValue['source'][]
}
export interface ValuePool {
  values: GroundedValue[]
  complete: boolean
  warnings: string[]
}

/** Enumerates evidence, never generates new prose or guesses domain-specific identifiers. */
export function collectGroundedValues(
  request: string,
  observations: Array<{ id: string; value: unknown }>,
  limits = { maxValues: 500, maxDepth: 8, maxValueBytes: 8000 },
): ValuePool {
  if (Object.values(limits).some((n) => !Number.isSafeInteger(n) || n < 1))
    throw new Error('Invalid value limits.')
  const values: GroundedValue[] = []
  const warnings = new Set<string>()
  const encoder = new TextEncoder()
  const seen = new Set<string>()
  const add = (value: unknown, source: GroundedValue['source']) => {
    const serialized = JSON.stringify(value)
    if (serialized === undefined) return
    if (encoder.encode(serialized).byteLength > limits.maxValueBytes) {
      warnings.add('Some values exceed the value byte budget.')
      return
    }
    const key = JSON.stringify([source, value])
    if (seen.has(key)) return
    if (values.length >= limits.maxValues) {
      warnings.add('Value enumeration reached its count budget.')
      return
    }
    seen.add(key)
    values.push({ id: 'value_' + values.length, value, source })
  }
  const addTextReferences = (text: string, source: GroundedValue['source']) => {
    if (text.length > 64_000) {
      warnings.add('Text reference extraction exceeds its character budget.')
      return
    }
    for (const match of text.matchAll(/https?:\/\/[^\s<>"'`\\]+/g)) {
      let reference = match[0]
      // Remove only unmatched closing delimiters, retaining balanced URL punctuation.
      for (const [open, close] of [
        ['(', ')'],
        ['[', ']'],
        ['{', '}'],
      ])
        while (
          reference.endsWith(close) &&
          reference.split(close).length > reference.split(open).length
        )
          reference = reference.slice(0, -1)
      try {
        const url = new URL(reference)
        if (url.protocol !== 'https:' && url.protocol !== 'http:') continue
        add(reference, {
          ...source,
          path:
            source.path +
            '/characters:' +
            match.index! +
            ':' +
            (match.index! + reference.length),
        })
      } catch {
        /* Invalid references are not repaired. */
      }
      if (values.length >= limits.maxValues) {
        warnings.add('Text reference enumeration reached its count budget.')
        break
      }
    }
  }
  const walk = (
    value: unknown,
    id: string,
    path: string,
    depth: number,
    ancestors: Set<object>,
    kind: 'request' | 'observation' = 'observation',
  ) => {
    if (depth > limits.maxDepth) {
      warnings.add('Observation nesting exceeds the depth budget.')
      return
    }
    if (value !== null && typeof value === 'object') {
      if (ancestors.has(value)) {
        warnings.add('Cyclic observation cannot be enumerated.')
        return
      }
      const next = new Set(ancestors)
      next.add(value)
      // MCP text blocks may encode structured JSON without structuredContent.
      // Decode only complete JSON containers, keeping the raw text as evidence too.
      if (kind === 'observation' && !Array.isArray(value)) {
        const block = value as Record<string, unknown>
        if (block.type === 'text' && typeof block.text === 'string') {
          const text = block.text.trim()
          if (text.startsWith('{') || text.startsWith('[')) {
            if (encoder.encode(text).byteLength > 64_000) {
              warnings.add('JSON text block exceeds the parsing byte budget.')
            } else {
              try {
                const parsed: unknown = JSON.parse(text)
                walk(
                  parsed,
                  id,
                  path + '/text/parsed-json',
                  depth + 2,
                  next,
                  kind,
                )
              } catch {
                // Prose, incomplete JSON, and malformed JSON stay ordinary text.
              }
            }
          }
        }
      }
      // Leaves first so large response envelopes cannot crowd out identifiers.
      for (const [key, child] of Object.entries(value)) {
        if (values.length >= limits.maxValues) {
          warnings.add('Value enumeration reached its count budget.')
          break
        }
        walk(
          child,
          id,
          path + '/' + key.replaceAll('~', '~0').replaceAll('/', '~1'),
          depth + 1,
          next,
          kind,
        )
      }
      try {
        add(value, { kind, id, path })
      } catch {
        warnings.add('Observation is not serializable JSON.')
      }
    } else {
      add(value, { kind, id, path })
      if (typeof value === 'string')
        addTextReferences(value, { kind, id, path })
    }
  }
  add(request, { kind: 'request', id: 'request', path: '' })
  addTextReferences(request, { kind: 'request', id: 'request', path: '' })
  // Only explicitly delimited JSON is parsed. Code fences in other languages are never executed.
  const jsonValues: Array<{ text: string; start: number; end: number }> = []
  const trimmed = request.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const start = request.indexOf(trimmed)
    jsonValues.push({ text: trimmed, start, end: start + trimmed.length })
  }
  for (const match of request.matchAll(
    /^```json[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/gm,
  )) {
    const start = match.index! + match[0].indexOf('\n') + 1
    jsonValues.push({ text: match[1]!, start, end: start + match[1]!.length })
  }
  for (const block of jsonValues) {
    if (encoder.encode(block.text).byteLength > 64_000) {
      warnings.add('Explicit JSON exceeds the parsing byte budget.')
      continue
    }
    try {
      const parsed: unknown = JSON.parse(block.text)
      walk(
        parsed,
        'request',
        `characters:${block.start}:${block.end}/json`,
        0,
        new Set(),
        'request',
      )
    } catch {
      warnings.add('Explicit JSON could not be parsed.')
    }
  }
  // Quoted spans have explicit boundaries, useful for names and verbatim message bodies.
  for (const match of request.matchAll(/"([^"\n]+)"|“([^”\n]+)”/g))
    add(match[1] ?? match[2], {
      kind: 'request',
      id: 'request',
      path:
        'characters:' +
        (match.index! + 1) +
        ':' +
        (match.index! + match[0].length - 1),
    })
  for (const observation of observations)
    walk(observation.value, observation.id, '', 0, new Set())
  const words = [...request.matchAll(/\S+/g)]
  for (let length = 1; length <= 6; length++)
    for (let start = 0; start + length <= words.length; start++) {
      if (values.length >= limits.maxValues) {
        warnings.add('Request span enumeration reached its count budget.')
        break
      }
      const first = words[start]!,
        last = words[start + length - 1]!
      const from = first.index!,
        to = last.index! + last[0].length
      const text = request.slice(from, to)
      add(text, {
        kind: 'request',
        id: 'request',
        path: 'characters:' + from + ':' + to,
      })
      // Offer punctuation-bounded substrings as alternatives, not replacements.
      // Selection still decides whether punctuation belongs to the intended value.
      const leading =
        text.match(/^[\p{Ps}\p{Pe}\p{Pi}\p{Pf}.,!?;:"']+/u)?.[0].length ?? 0
      const trailing =
        text.match(/[\p{Ps}\p{Pe}\p{Pi}\p{Pf}.,!?;:"']+$/u)?.[0].length ?? 0
      for (const [left, right] of [
        [leading, 0],
        [0, trailing],
        [leading, trailing],
      ]) {
        if (left + right === 0 || left + right >= text.length) continue
        add(request.slice(from + left, to - right), {
          kind: 'request',
          id: 'request',
          path: 'characters:' + (from + left) + ':' + (to - right),
        })
      }
      // Sentence punctuation is not part of a numeric input literal.
      const numericText = text.replace(/[.,!?;:]$/, '')
      if (
        length === 1 &&
        /^-?\d+(\.\d+)?$/.test(numericText) &&
        Number.isFinite(Number(numericText))
      )
        add(Number(numericText), {
          kind: 'request',
          id: 'request',
          path: 'number-at:' + from,
        })
    }
  return { values, complete: warnings.size === 0, warnings: [...warnings] }
}

/** The schema constrains possible values; it is not evidence of the user's intent. */
export function candidatesForSchema(
  schema: Record<string, unknown>,
  pool: ValuePool,
): GroundedValue[] {
  const validator = new Validator(schema)
  const values = [...pool.values]
  const permitsBoolean = (definition: Record<string, unknown>) =>
    definition.type === 'boolean' ||
    (Array.isArray(definition.type) && definition.type.includes('boolean'))
  if (
    permitsBoolean(schema) ||
    ['anyOf', 'oneOf'].some(
      (key) =>
        Array.isArray(schema[key]) &&
        schema[key].some(
          (branch: unknown) =>
            branch &&
            typeof branch === 'object' &&
            permitsBoolean(branch as Record<string, unknown>),
        ),
    )
  )
    for (const value of [true, false])
      values.push({
        id: 'boolean_' + value,
        value,
        source: { kind: 'schema', id: 'boolean', path: '/' + value },
      })
  if (Array.isArray(schema.enum))
    schema.enum.forEach((value, index) =>
      values.push({
        id: 'enum_' + index,
        value,
        source: { kind: 'schema', id: 'enum', path: '/' + index },
      }),
    )
  if (Object.hasOwn(schema, 'const'))
    values.push({
      id: 'const',
      value: schema.const,
      source: { kind: 'schema', id: 'const', path: '' },
    })
  if (Object.hasOwn(schema, 'default'))
    values.push({
      id: 'default',
      value: schema.default,
      source: { kind: 'schema', id: 'default', path: '' },
    })
  const grouped = new Map<string, GroundedValue>()
  for (const candidate of values) {
    if (!validator.validate(candidate.value).valid) continue
    const key = JSON.stringify(candidate.value)
    const existing = grouped.get(key)
    if (!existing) {
      grouped.set(key, { ...candidate })
      continue
    }
    const sources = [existing.source, ...(existing.otherSources ?? [])]
    if (
      !sources.some(
        (source) => JSON.stringify(source) === JSON.stringify(candidate.source),
      )
    )
      existing.otherSources = [
        ...(existing.otherSources ?? []),
        candidate.source,
      ]
  }
  return [...grouped.values()]
}
