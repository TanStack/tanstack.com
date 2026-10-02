import { describe, expect, it } from 'vitest'
import {
  maxSkillImportBytes,
  maxSkillContextChars,
  parseSkillMarkdown,
  serializeSkillMarkdown,
  skillCommandSchema,
  skillDocumentSchema,
  validateSkillContext,
  type SkillVersion,
} from '../../src/chat/core/skills'

const base = {
  name: 'weekly-review',
  description: 'Write a weekly review from the supplied evidence.',
  instructions: '# Review\n\nKeep the source qualifiers.\n',
}
const source = (header: string, body = base.instructions) =>
  `---\n${header}\n---\n${body}`
const required = 'name: weekly-review\ndescription: Write a weekly review.'

describe('single-file skill format', () => {
  it.each(['weekly-review', 'résumé', '工作回顾', 'αριθμός-2', '١٢-مراجعة'])(
    'accepts the standard Unicode name %s',
    (name) => {
      expect(skillDocumentSchema.parse({ ...base, name }).name).toBe(name)
    },
  )

  it('normalizes compatibility characters before validating the name', () => {
    expect(
      parseSkillMarkdown(
        source('name: ｗｅｅｋｌｙ-review\ndescription: Review.'),
      ).name,
    ).toBe('weekly-review')
    expect(
      skillDocumentSchema.parse({ ...base, name: 'é'.repeat(64) }).name,
    ).toHaveLength(64)
  })

  it.each([
    'Review',
    '-review',
    'review-',
    'weekly--review',
    'weekly review',
    'a/b',
    'a'.repeat(65),
    '',
  ])('rejects a name outside the standard constraints: %j', (name) => {
    expect(skillDocumentSchema.safeParse({ ...base, name }).success).toBe(false)
  })

  it('round-trips recognized metadata and exact Markdown content', () => {
    const document = {
      ...base,
      description: 'Review: sources, decisions, and unresolved work.',
      license: 'Proprietary. See LICENSE.txt.',
      compatibility: 'Requires a connected source that the user can access.',
      metadata: { author: 'Example', version: '1.0', 'gum.example': 'true' },
      allowedTools: 'Read Bash(git:*)',
      instructions:
        '  # Review\n\n```yaml\nvalue: "---"\n```\n\n---\n\nKeep café, 工作 and 🙂 intact.\n\n',
    }
    const markdown = serializeSkillMarkdown(document)
    expect(markdown).toContain('allowed-tools:')
    expect(markdown).not.toContain('allowedTools:')
    expect(parseSkillMarkdown(markdown)).toEqual(document)
  })

  it('accepts UTF-8 BOM and CRLF input with normalized line endings', () => {
    const parsed = parseSkillMarkdown(
      `\uFEFF${source(required, '# Review\n\nFirst.\n').replace(/\n/g, '\r\n')}`,
    )
    expect(parsed.instructions).toBe('# Review\n\nFirst.\n')
  })

  it('rejects metadata keys that would silently disappear during conversion', () => {
    expect(() =>
      parseSkillMarkdown(
        source(`${required}\nmetadata:\n  __proto__: keep-me`),
      ),
    ).toThrow(/metadata key __proto__/)
    const metadata = Object.fromEntries([['__proto__', 'keep-me']])
    expect(skillDocumentSchema.safeParse({ ...base, metadata }).success).toBe(
      false,
    )
    expect(
      parseSkillMarkdown(
        serializeSkillMarkdown({
          ...base,
          metadata: { constructor: 'preserved', prototype: 'preserved' },
        }),
      ).metadata,
    ).toEqual({ constructor: 'preserved', prototype: 'preserved' })
  })

  it('rejects lone surrogates before UTF-8 replacement can change immutable content', () => {
    for (const field of [
      'description',
      'instructions',
      'license',
      'compatibility',
      'allowedTools',
    ]) {
      expect(
        skillDocumentSchema.safeParse({ ...base, [field]: `text\ud800` })
          .success,
      ).toBe(false)
      expect(
        skillDocumentSchema.safeParse({ ...base, [field]: `text\udfff` })
          .success,
      ).toBe(false)
      expect(
        skillDocumentSchema.safeParse({ ...base, [field]: 'text🙂' }).success,
      ).toBe(true)
    }
    expect(
      skillDocumentSchema.safeParse({
        ...base,
        metadata: { version: '\ud800' },
      }).success,
    ).toBe(false)
    expect(
      skillDocumentSchema.safeParse({
        ...base,
        metadata: { ['key\ud800']: 'text' },
      }).success,
    ).toBe(false)
    expect(
      skillDocumentSchema.safeParse({
        ...base,
        metadata: { ['key🙂']: 'text🙂' },
      }).success,
    ).toBe(true)
  })

  it.each([
    `name: weekly-review\nname: different\ndescription: Review.`,
    `${required}\nmetadata:\n  version: one\n  version: two`,
  ])(
    'rejects duplicate YAML keys rather than choosing an instruction set',
    (header) => {
      expect(() => parseSkillMarkdown(source(header))).toThrow(/YAML/)
    },
  )

  it('rejects aliases, including aliases inside metadata', () => {
    expect(() =>
      parseSkillMarkdown(
        source('name: &name weekly-review\ndescription: *name'),
      ),
    ).toThrow(/aliases/)
    expect(() =>
      parseSkillMarkdown(
        source(
          `${required}\nmetadata:\n  author: &author Example\n  version: *author`,
        ),
      ),
    ).toThrow(/aliases/)
  })

  it.each([
    '!execute echo-secret',
    '!!js/function function() { return "bad" }',
  ])('rejects unsupported YAML tags without executing them: %s', (value) => {
    expect(() =>
      parseSkillMarkdown(source(`name: weekly-review\ndescription: ${value}`)),
    ).toThrow(/YAML|tags/)
  })

  it.each([
    '- name: weekly-review\n- description: Review.',
    'a scalar',
    'null',
    '',
  ])('rejects a non-mapping frontmatter document', (header) => {
    expect(() => parseSkillMarkdown(source(header))).toThrow(/mapping/)
  })

  it.each([
    'name: weekly-review',
    'description: Review.',
    'name: weekly-review\ndescription: " "',
    'name: weekly-review\ndescription: [Review]',
    `${required}\nmetadata: [one, two]`,
    `${required}\nmetadata:\n  version: 1`,
    `${required}\nallowed-tools: [Read, Bash]`,
    `${required}\ncompatibility: ""`,
  ])('rejects missing or incorrectly typed standard fields', (header) => {
    expect(() => parseSkillMarkdown(source(header))).toThrow()
  })

  it.each([
    'context: fork',
    'model: expensive-model',
    'disable-model-invocation: true',
    'hooks: {}',
  ])('explains unsupported host-specific fields: %s', (field) => {
    expect(() => parseSkillMarkdown(source(`${required}\n${field}`))).toThrow(
      /Unsupported skill metadata: .*host-specific/,
    )
  })

  it('requires bounded nonempty instructions without cutting them', () => {
    expect(
      parseSkillMarkdown(source(required, 'x'.repeat(12000))).instructions,
    ).toHaveLength(12000)
    expect(() =>
      parseSkillMarkdown(source(required, 'x'.repeat(12001))),
    ).toThrow()
    expect(() => parseSkillMarkdown(source(required, ' \n\t'))).toThrow(
      /instructions/,
    )
  })

  it('measures the complete import in UTF-8 bytes, not character count', () => {
    const oversized = source(required, '界'.repeat(11000))
    expect(oversized.length).toBeLessThan(12000)
    expect(new TextEncoder().encode(oversized).length).toBeGreaterThan(
      maxSkillImportBytes,
    )
    expect(() => parseSkillMarkdown(oversized)).toThrow(/32 KiB/)
    expect(
      skillDocumentSchema.safeParse({
        ...base,
        instructions: '界'.repeat(11000),
      }).success,
    ).toBe(false)
  })

  it('bounds the exported document including metadata and YAML escaping', () => {
    const metadata = Object.fromEntries(
      Array.from({ length: 32 }, (_, index) => [
        `entry-${index}`,
        'x'.repeat(1000),
      ]),
    )
    expect(
      skillDocumentSchema.safeParse({
        ...base,
        instructions: 'x'.repeat(1000),
        metadata,
      }).success,
    ).toBe(false)
    expect(() =>
      serializeSkillMarkdown({
        ...base,
        instructions: 'x'.repeat(1000),
        metadata,
      }),
    ).toThrow()
  })

  it('preserves resource links, shell placeholders and permission declarations as inert text', () => {
    const instructions =
      'Read [the guide](references/guide.md).\nRun scripts/review.py.\n!`echo do-not-run`\n$ARGUMENTS\n'
    const parsed = parseSkillMarkdown(
      source(
        `${required}\nallowed-tools: Bash(*)\nlicense: LICENSE.txt`,
        instructions,
      ),
    )
    expect(parsed).toEqual({
      name: 'weekly-review',
      description: 'Write a weekly review.',
      allowedTools: 'Bash(*)',
      license: 'LICENSE.txt',
      instructions,
    })
    expect(Object.keys(parsed).sort()).toEqual([
      'allowedTools',
      'description',
      'instructions',
      'license',
      'name',
    ])
  })

  it('rejects controls and distinguishes immutable content updates from enablement commands', () => {
    expect(
      skillDocumentSchema.safeParse({
        ...base,
        instructions: 'Read\u0000this.',
      }).success,
    ).toBe(false)
    const command = {
      id: 'f86272ac-1285-41dd-ae16-80533c6ee825',
      commandId: '3d5ff48c-c69a-42f4-90e5-59e50844ce2c',
      expectedRevision: 2,
    }
    expect(
      skillCommandSchema.safeParse({
        ...command,
        type: 'enabled',
        enabled: false,
      }).success,
    ).toBe(true)
    expect(
      skillCommandSchema.safeParse({
        ...command,
        type: 'enabled',
        enabled: false,
        document: base,
      }).success,
    ).toBe(false)
    expect(
      skillCommandSchema.safeParse({
        ...command,
        type: 'update',
        document: base,
      }).success,
    ).toBe(true)
    expect(
      skillCommandSchema.safeParse({
        ...command,
        type: 'update',
        expectedRevision: 0,
        document: base,
      }).success,
    ).toBe(false)
  })
})

describe('active skill context budget', () => {
  const version = (instructions: string): SkillVersion => ({
    id: crypto.randomUUID(),
    name: base.name,
    description: base.description,
    version: 1,
    revision: 1,
    enabled: true,
    archived: false,
    createdAt: 1,
    updatedAt: 1,
    document: { ...base, instructions },
  })
  const rendered = (skills: SkillVersion[]) =>
    JSON.stringify(
      skills.map(({ id, version, document }) => ({ id, version, ...document })),
    )
      .replaceAll('<', '\\u003c')
      .replaceAll('>', '\\u003e')
      .replaceAll('&', '\\u0026')
      .replaceAll('\u2028', '\\u2028')
      .replaceAll('\u2029', '\\u2029')

  it('accepts the exact escaped boundary and rejects one extra character without modifying instructions', () => {
    const skill = version('')
    const prefix = '<>&\u2028\u2029🙂'
    skill.document.instructions = prefix
    const remaining = maxSkillContextChars - rendered([skill]).length
    skill.document.instructions +=
      '<'.repeat(Math.floor(remaining / 6)) + 'x'.repeat(remaining % 6)
    expect(skillDocumentSchema.safeParse(skill.document).success).toBe(true)
    expect(rendered([skill])).toHaveLength(maxSkillContextChars)
    expect(() => validateSkillContext([skill])).not.toThrow()
    skill.document.instructions += 'x'
    const original = skill.document.instructions
    expect(rendered([skill])).toHaveLength(maxSkillContextChars + 1)
    expect(() => validateSkillContext([skill])).toThrow(
      /Choose fewer skills or shorter instructions/,
    )
    expect(skill.document.instructions).toBe(original)
  })

  it('bounds the union, including escaped metadata, even when every document fits separately', () => {
    const skills = [
      version('x'.repeat(11000)),
      version('x'.repeat(11000)),
      version('x'.repeat(11000)),
    ]
    skills[0].document.metadata = Object.fromEntries(
      Array.from({ length: 8 }, (_, index) => [
        `escaped<${index}`,
        '&'.repeat(1000),
      ]),
    )
    for (const skill of skills) {
      expect(skillDocumentSchema.safeParse(skill.document).success).toBe(true)
      expect(() => validateSkillContext([skill])).not.toThrow()
    }
    expect(rendered(skills).length).toBeGreaterThan(maxSkillContextChars)
    expect(() => validateSkillContext(skills)).toThrow(/too long together/)
  })

  it('requires at most three distinct IDs with a single exact version each', () => {
    const skill = version('Summarize.')
    expect(() => validateSkillContext([])).not.toThrow()
    expect(() =>
      validateSkillContext([skill, version('Two.'), version('Three.')]),
    ).not.toThrow()
    expect(() => validateSkillContext([skill, skill])).toThrow(/one version/)
    expect(() =>
      validateSkillContext([skill, { ...skill, version: 2 }]),
    ).toThrow(/one version/)
    expect(() =>
      validateSkillContext(Array.from({ length: 4 }, () => version('Read.'))),
    ).toThrow(/up to 3/)
  })
})
