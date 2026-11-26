# Chat execution adaptation

The current chat execution bridge is not connected to the shared site's SDK runtime. Preserve the server lease, command registry, receipt, replay and snapshot contracts while replacing that host transport.

The installed API 6 SDK exposes HostedKernel, an isolated-frame client with an expectedBuildId handshake. It already provides the operations below. Reuse it instead of implementing another kernel, file system, process manager or preview renderer.

| Chat operation  | Existing SDK operation                      | Required chat contract                                                                            |
| --------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| read_file       | HostedKernel.readFile/readText              | Preserve output byte limits, authorized paths and exact committed delivery identity               |
| write_file      | HostedKernel.writeFile/writeText            | Preserve payload limits and mutation receipts                                                     |
| run             | HostedKernel.run or bounded spawned process | Preserve exit, output, stop and uncertain-outcome evidence                                        |
| spawn           | HostedKernel.spawn                          | Bind returned process to the reserved chat processId and drain bounded output                     |
| stop_process    | Process kill/dispose                        | Acknowledge actual cleanup, retain unknown when cleanup cannot be proved                          |
| preview_open    | HostedKernel.mountPreview                   | Bind the preview to its reserved ID and existing viewport ownership                               |
| preview_inspect | Preview.inspect                             | Bound and validate returned evidence                                                              |
| preview_click   | Preview.click                               | Preserve approval and delivery identity                                                           |
| preview_close   | Preview.close                               | Confirm exact preview cleanup                                                                     |
| save_snapshot   | HostedKernel.snapshot                       | Encode through the existing immutable snapshot format, do not substitute a browser checkpoint key |
| close           | HostedKernel.close/shutdown                 | Preserve cooperative shutdown evidence, disconnect alone does not prove cleanup                   |

Use the existing ExecutionHostBridge boundary. ExecutionOwnersProvider owns one runtime service above conversation routes. Pane hiding must continue to leave that service alive, route/account teardown must revoke it, and hot module replacement must revoke the previous executable owner. Existing server APIs and command identity checks remain authoritative.

The API 5 artifact's hashes cannot identify API 6. Before wiring the replacement, establish an actual package/build identity and hosted runtime URL. Pass the exact build identity to the SDK handshake and retain it in chat session and snapshot metadata. A version label, local build success, or a temporary dependency path is insufficient evidence. Fresh chat data is permitted, so incompatible old experimental sessions do not need migration.

Production needs a verified isolated host and preview origin in TanStack infrastructure. Do not remove the existing DEV/origin guard and continue to use the old broker. The API 6 HostedKernel declaration is available in the installed package, but hosted behavior, cleanup, snapshot compatibility and artifact distribution still require real verification.

The sibling runtime work remains active. Current local package references are machine-specific and a recent sibling plain-HTML build probe fails. No approved deployment has been performed. This document records the concrete reuse path, it does not claim the host adaptation is implemented.
