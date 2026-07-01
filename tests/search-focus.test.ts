import assert from 'node:assert/strict'
import {
  focusSearchInputInContainer,
  getSearchInputFromContainer,
} from '../src/utils/searchFocus'

type MockInput = {
  type: string
  getAttribute: (name: string) => string | null
  focus: (options?: FocusOptions) => void
}

function createMockInput({
  type,
  cmdkInput = false,
}: {
  type: string
  cmdkInput?: boolean
}): MockInput {
  return {
    type,
    getAttribute: (name: string) => {
      if (name === 'cmdk-input' && cmdkInput) {
        return ''
      }
      return null
    },
    focus: () => {},
  }
}

function createMockContainer(
  inputsBySelector: Record<string, MockInput | null>,
) {
  return {
    querySelector<T>(selector: string) {
      return (inputsBySelector[selector] ?? null) as T
    },
  }
}

const cmdkInput = createMockInput({
  type: 'text',
  cmdkInput: true,
})

const cmdkContainer = createMockContainer({
  '[cmdk-input]': cmdkInput,
  'input[aria-label="Search TanStack"]': cmdkInput,
  'input[aria-label="Search"]': null,
  'input[type="search"]': createMockInput({ type: 'search' }),
})

assert.equal(
  getSearchInputFromContainer(cmdkContainer),
  cmdkInput,
  'prefers cmdk search input over type=search',
)

const searchTypeInput = createMockInput({ type: 'search' })
const searchTypeContainer = createMockContainer({
  '[cmdk-input]': null,
  'input[aria-label="Search TanStack"]': null,
  'input[aria-label="Search"]': searchTypeInput,
  'input[type="search"]': searchTypeInput,
})

assert.equal(
  getSearchInputFromContainer(searchTypeContainer),
  searchTypeInput,
  'falls back to search input selectors',
)

let focusedInput: MockInput | null = null
const focusableInput = createMockInput({ type: 'text', cmdkInput: true })
focusableInput.focus = () => {
  focusedInput = focusableInput
}

const focusContainer = createMockContainer({
  '[cmdk-input]': focusableInput,
  'input[aria-label="Search TanStack"]': focusableInput,
  'input[aria-label="Search"]': null,
  'input[type="search"]': null,
})

focusSearchInputInContainer(focusContainer)
assert.equal(focusedInput, focusableInput, 'focus helper targets search input')

console.log('search-focus tests passed')
