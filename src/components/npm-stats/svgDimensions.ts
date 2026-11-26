// SVGLength.SVG_LENGTHTYPE_PERCENTAGE. Inlined so this module does not depend on
// the SVGLength global (unavailable outside the browser).
const SVG_LENGTHTYPE_PERCENTAGE = 2

type AnimatedLengthLike = {
  baseVal: { unitType: number; value: number }
}

type SvgLike = {
  width: AnimatedLengthLike
  height: AnimatedLengthLike
  viewBox: { baseVal: { width: number; height: number } | null }
  getBoundingClientRect: () => { width: number; height: number }
}

function isNotSupportedError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'NotSupportedError'
  )
}

/**
 * Reads an absolute SVG length in user units, returning 0 when the length is
 * relative (e.g. `width="100%"`). Browsers throw `NotSupportedError` when a
 * relative length cannot be resolved, which happens for SVGs that are not
 * attached to the document (such as off-screen animated export frames).
 */
export function readAbsoluteSvgLength(length: AnimatedLengthLike) {
  const baseVal = length.baseVal
  if (baseVal.unitType === SVG_LENGTHTYPE_PERCENTAGE) return 0

  try {
    return baseVal.value
  } catch (error) {
    if (isNotSupportedError(error)) return 0
    throw error
  }
}

export function getSvgDimensions(svg: SvgLike) {
  const box = svg.getBoundingClientRect()
  const viewBox = svg.viewBox.baseVal
  const width =
    readAbsoluteSvgLength(svg.width) || viewBox?.width || box.width || 1
  const height =
    readAbsoluteSvgLength(svg.height) || viewBox?.height || box.height || 1

  return {
    width: Math.max(1, Math.ceil(width)),
    height: Math.max(1, Math.ceil(height)),
  }
}
