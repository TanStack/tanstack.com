export type ExamplePanel = 'playground' | 'code' | 'stackblitz' | 'codesandbox'

export type ExamplePanelOption = { id: ExamplePanel; label: string }

export function getExamplePanels({
  hasPlayground = false,
  hideStackblitzUrl = false,
  hideCodesandboxUrl = false,
}: {
  hasPlayground?: boolean
  hideStackblitzUrl?: boolean
  hideCodesandboxUrl?: boolean
}): Array<ExamplePanelOption> {
  const panels: Array<ExamplePanelOption> = []
  if (hasPlayground) panels.push({ id: 'playground', label: 'Playground' })
  else panels.push({ id: 'code', label: 'Code Explorer' })
  if (!hideStackblitzUrl) panels.push({ id: 'stackblitz', label: 'StackBlitz' })
  if (!hideCodesandboxUrl)
    panels.push({ id: 'codesandbox', label: 'CodeSandbox' })
  return panels
}

export function getExamplePanel(
  value: string | undefined,
  panels: ReadonlyArray<ExamplePanelOption>,
  embedEditor: 'stackblitz' | 'codesandbox' = 'stackblitz',
) {
  // Preserve links and preferences saved before the providers had separate tabs.
  const panel = value === 'sandbox' ? embedEditor : value
  return panels.find((candidate) => candidate.id === panel)?.id
}
