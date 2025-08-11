export function getGradientTextClass(
  colorFrom: string,
  colorTo: string,
  extra: string = ''
) {
  return `pr-1 inline-block text-transparent bg-clip-text bg-gradient-to-r ${colorFrom} ${colorTo} ${extra}`.trim()
}

// Keeping CTAs simple: callers pass className directly and use twMerge at call sites/components.
