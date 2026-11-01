import type { PalettePage } from './palette-types'
import type { RunModelController } from './useRunModel'
import type { RunModelSelection } from '../core/run-model'

export const modelPalettePage = (
  name: string,
  model: RunModelController,
  chooseModel: (selection: RunModelSelection) => void,
): PalettePage => ({
  type: 'list',
  title: `Model for ${name}`,
  items: (model.catalog?.choices ?? []).map((choice) => ({
    id: `model:${choice.selection.provider}:${choice.selection.model}`,
    label: choice.label,
    detail: choice.providerLabel,
    keywords: [choice.selection.model, choice.providerLabel],
    kind: 'setting',
    icon: 'model',
    disabledReason: choice.unavailableReason,
    run: () => {
      if (!choice.reasoning.some((mode) => mode.value !== 'default')) {
        chooseModel(choice.selection)
        return
      }
      return {
        type: 'list',
        title: `${choice.label} · Reasoning`,
        items: [
          { value: 'default', label: 'Default' },
          ...choice.reasoning.filter((mode) => mode.value !== 'default'),
        ].map((mode) => ({
          id: `reasoning:${mode.value}`,
          label: mode.label,
          kind: 'setting',
          icon: 'model',
          run: () =>
            chooseModel({ ...choice.selection, reasoning: mode.value }),
        })),
      }
    },
  })),
})
