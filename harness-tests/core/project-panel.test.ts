import { describe, expect, it } from 'vitest'
import { validateWorkspaceSearch } from '../../src/chat/core/navigation'
import {
  availableWorkspacePanels,
  readPanelState,
} from '../../src/chat/core/workspace-panels'

describe('personal project panel', () => {
  it('requires the caller to authorize personal projects', () => {
    expect(availableWorkspacePanels(true, true, true)).not.toContain('projects')
    expect(availableWorkspacePanels(false, false, false, true)).toContain(
      'projects',
    )
  })

  it('does not enable desktop or Kody panels with project access', () => {
    const panels = availableWorkspacePanels(false, false, false, true)
    expect(panels).not.toContain('commands')
    expect(panels).not.toContain('preview')
    expect(panels).not.toContain('browser')
    expect(panels).not.toContain('mail')
  })

  it('keeps the project tab and selection when hiding the side panel', () => {
    expect(
      readPanelState({
        panel: 'projects',
        panels: ['files', 'projects'],
        panelHidden: true,
      }),
    ).toEqual({
      tabs: ['files', 'projects'],
      active: 'projects',
      hidden: true,
      fullscreen: false,
    })
  })
})

it('keeps an exact project destination with a hidden side panel', () => {
  const project = '8eae7f52-a412-4343-bb2a-782b3e3c25b4'
  expect(
    validateWorkspaceSearch({
      project,
      panel: 'projects',
      panels: ['projects'],
      panelHidden: true,
    }),
  ).toMatchObject({
    project,
    panel: 'projects',
    panels: ['projects'],
    panelHidden: true,
  })
})
it('rejects invalid project destinations without dropping other navigation', () => {
  expect(
    validateWorkspaceSearch({ project: '../other-account', panel: 'projects' }),
  ).toMatchObject({ project: undefined, panel: 'projects' })
})
