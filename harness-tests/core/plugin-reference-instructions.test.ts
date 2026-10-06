import { expect, it } from 'vitest'
import { newAssistantTask } from '../../src/chat/core/assistant-task'
import { buildAssistantInstructions } from '../../src/chat/server/assistant-instructions'

const reference = {
  kind: 'plugin' as const,
  installationId: crypto.randomUUID(),
  version: 1,
  label: 'Project notes',
  detail: 'Installed v1',
}
const build = (enabledTools: string[]) =>
  buildAssistantInstructions(
    { name: 'Gum', purpose: '' },
    newAssistantTask('Read the selected package.', 'm'),
    [],
    { enabledTools, references: [reference] },
  )

it('exposes a selected plugin only as an exact context hint with inspection available', () => {
  const result = build(['inspect_plugin', 'read_plugin_file', 'read_skill'])
  const text = result.systemPrompts.join('\n')
  expect(text).toContain(JSON.stringify(reference.installationId))
  expect(text).toContain('"version":1')
  expect(text).toContain('context hints, not routing rules or permission')
  expect(text).toContain('Activate only skills relevant to the current request')
  expect(text).toContain(
    'Installation, enablement, connection setup and execution are separate states',
  )
  expect(result.manifest.sections).toContainEqual({
    id: 'capability.plugins.inspect',
    version: '1',
  })
  expect(result.manifest.sections).toContainEqual({
    id: 'capability.plugins.files',
    version: '2',
  })
  expect(
    result.manifest.sections.some((item) =>
      item.id.startsWith('context.skills'),
    ),
  ).toBe(false)
})

it.each(
  [[], ['list_plugins'], ['read_plugin_file'], ['read_skill']].map((tools) => ({
    tools,
  })),
)(
  'does not advertise a selected plugin without its inspector: %j',
  ({ tools }) => {
    const result = build(tools)
    expect(result.systemPrompts.join('\n')).not.toContain(
      reference.installationId,
    )
    expect(
      result.manifest.sections.some(
        (item) => item.id === 'capability.plugins.inspect',
      ),
    ).toBe(false)
  },
)
