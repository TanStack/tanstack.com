import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getSvgDimensions,
  readAbsoluteSvgLength,
} from '../src/components/npm-stats/svgDimensions'

const SVG_LENGTHTYPE_NUMBER = 1
const SVG_LENGTHTYPE_PERCENTAGE = 2

function length(unitType: number, value: number) {
  return { baseVal: { unitType, value } }
}

function throwingLength(error: Error) {
  return {
    baseVal: {
      unitType: SVG_LENGTHTYPE_NUMBER,
      get value(): number {
        throw error
      },
    },
  }
}

function notSupportedError() {
  const error = new Error('Could not resolve relative length.')
  error.name = 'NotSupportedError'
  return error
}

function svg({
  width,
  height,
  viewBox = { width: 640, height: 320 },
  box = { width: 0, height: 0 },
}: {
  width: ReturnType<typeof length> | ReturnType<typeof throwingLength>
  height: ReturnType<typeof length> | ReturnType<typeof throwingLength>
  viewBox?: { width: number; height: number } | null
  box?: { width: number; height: number }
}) {
  return {
    width,
    height,
    viewBox: { baseVal: viewBox },
    getBoundingClientRect: () => box,
  }
}

test('percentage lengths fall back to the viewBox size', () => {
  const percentageLength = {
    baseVal: {
      unitType: SVG_LENGTHTYPE_PERCENTAGE,
      get value(): number {
        throw notSupportedError()
      },
    },
  }

  assert.deepEqual(
    getSvgDimensions(
      svg({ width: percentageLength, height: percentageLength }),
    ),
    { width: 640, height: 320 },
  )
})

test('unresolvable lengths fall back instead of throwing', () => {
  assert.deepEqual(
    getSvgDimensions(
      svg({
        width: throwingLength(notSupportedError()),
        height: throwingLength(notSupportedError()),
        viewBox: null,
        box: { width: 400.2, height: 200.5 },
      }),
    ),
    { width: 401, height: 201 },
  )
})

test('absolute lengths are used directly', () => {
  assert.deepEqual(
    getSvgDimensions(
      svg({
        width: length(SVG_LENGTHTYPE_NUMBER, 800),
        height: length(SVG_LENGTHTYPE_NUMBER, 400),
      }),
    ),
    { width: 800, height: 400 },
  )
})

test('unexpected errors are not swallowed', () => {
  assert.throws(
    () => readAbsoluteSvgLength(throwingLength(new TypeError('boom'))),
    TypeError,
  )
})
