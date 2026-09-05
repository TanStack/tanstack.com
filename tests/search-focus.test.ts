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
  'input[aria-label="Search TanStack"]': createMockInput({ type: 'text' }),
  'input[aria-label="Search"]': null,
  'input[type="search"]': createMockInput({ type: 'search' }),
})

assert.equal(
  getSearchInputFromContainer(cmdkContainer),
  cmdkInput,
  'prefers cmdk search input over type=search',
)

const tanStackLabelInput = createMockInput({ type: 'text' })
const tanStackLabelContainer = createMockContainer({
  '[cmdk-input]': null,
  'input[aria-label="Search TanStack"]': tanStackLabelInput,
  'input[aria-label="Search"]': createMockInput({ type: 'text' }),
  'input[type="search"]': createMockInput({ type: 'search' }),
})

assert.equal(
  getSearchInputFromContainer(tanStackLabelContainer),
  tanStackLabelInput,
  'falls back to TanStack search label input',
)

const searchLabelInput = createMockInput({ type: 'text' })
const searchLabelContainer = createMockContainer({
  '[cmdk-input]': null,
  'input[aria-label="Search TanStack"]': null,
  'input[aria-label="Search"]': searchLabelInput,
  'input[type="search"]': createMockInput({ type: 'search' }),
})

assert.equal(
  getSearchInputFromContainer(searchLabelContainer),
  searchLabelInput,
  'falls back to generic search label input',
)

const searchTypeInput = createMockInput({ type: 'search' })
const searchTypeContainer = createMockContainer({
  '[cmdk-input]': null,
  'input[aria-label="Search TanStack"]': null,
  'input[aria-label="Search"]': null,
  'input[type="search"]': searchTypeInput,
})

assert.equal(
  getSearchInputFromContainer(searchTypeContainer),
  searchTypeInput,
  'falls back to search input type',
)

assert.equal(
  getSearchInputFromContainer(null),
  null,
  'returns null without a container',
)

assert.equal(
  getSearchInputFromContainer(createMockContainer({})),
  null,
  'returns null when no search input matches',
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
