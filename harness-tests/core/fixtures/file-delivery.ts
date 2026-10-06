import type { UIMessage } from '@tanstack/ai'
import type { FileDelivery } from '../../../src/chat/core/file-deliveries'

export const fileDeliveryFixture: FileDelivery = {
  kind: 'file',
  workspaceId: 'personal:fixture',
  toolCallId: 'save-call',
  file: {
    id: '988d3119-3780-4a4c-a92c-a674a64dd81b',
    botId: 'original',
    name: 'summary.md',
    mediaType: 'text/markdown',
    size: 123,
    sha256: 'a'.repeat(64),
    source: 'assistant',
    state: 'ready',
    createdAt: 1,
  },
}

export function deliveredMessage(): UIMessage {
  return {
    id: 'saved-message',
    role: 'assistant',
    parts: [
      {
        type: 'tool-call',
        id: fileDeliveryFixture.toolCallId,
        name: 'save_file',
        arguments: '{}',
        state: 'complete',
        output: { ok: true },
      },
    ],
    metadata: { gumFileDeliveries: [structuredClone(fileDeliveryFixture)] },
  }
}
