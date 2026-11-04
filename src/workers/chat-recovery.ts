// Preserve the namespaces created on the site during the failed rollout.
// They keep their real implementations and storage, without loading chat in SSR.
export {
  StreamObject,
  WorkspaceSync,
  Conversation,
} from '~/chat/server/entries'

export default {
  fetch() {
    return new Response('Not found', { status: 404 })
  },
}
