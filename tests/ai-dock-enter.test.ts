import assert from 'node:assert/strict'
import test from 'node:test'
import { submitOnEnter } from '../src/utils/ai-dock-enter'

function press(key: string, isComposing: boolean, keyCode: number) {
  let prevented = 0
  let submitted = 0
  submitOnEnter(
    {
      key,
      nativeEvent: { isComposing, keyCode },
      preventDefault: () => {
        prevented++
      },
    },
    () => {
      submitted++
    },
  )
  return { prevented, submitted }
}

test('Enter during composition neither submits nor prevents default', () => {
  assert.deepEqual(press('Enter', true, 229), { prevented: 0, submitted: 0 })
})

test('Enter with isComposing=false and keyCode=229 neither submits nor prevents default', () => {
  assert.deepEqual(press('Enter', false, 229), { prevented: 0, submitted: 0 })
})

test('ordinary Enter submits once', () => {
  assert.deepEqual(press('Enter', false, 13), { prevented: 1, submitted: 1 })
})

test('non-Enter key does not submit', () => {
  assert.deepEqual(press('a', false, 65), { prevented: 0, submitted: 0 })
})
