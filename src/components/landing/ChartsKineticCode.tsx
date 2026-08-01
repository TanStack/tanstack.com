import {
  defaultHighlighter,
  type HighlightTokenClass,
} from '@tanstack/highlight'
import { diffArrays } from 'diff'
import * as React from 'react'

type CodeAtom = {
  className?: HighlightTokenClass
  enter: boolean
  line: number
  matchKey?: string
  value: string
  whitespace: boolean
}

type VisibleAtom = {
  atom: CodeAtom
  index: number
}

type CodeLine = {
  atoms: ReadonlyArray<VisibleAtom>
  line: number
}

type MatchedCode = {
  current: ReadonlyArray<CodeAtom>
  previous: ReadonlyArray<CodeAtom>
}

const transitionDuration = 980

export function ChartsKineticCode({
  currentSource,
  previousSource,
  reducedMotion,
}: {
  currentSource: string
  previousSource?: string
  reducedMotion: boolean
}) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const currentRef = React.useRef<HTMLPreElement>(null)
  const previousRef = React.useRef<HTMLPreElement>(null)
  const matched = React.useMemo(
    () => matchCodeAtoms(previousSource, currentSource),
    [currentSource, previousSource],
  )

  React.useLayoutEffect(() => {
    const root = rootRef.current
    const current = currentRef.current
    const previous = previousRef.current
    if (
      reducedMotion ||
      !root ||
      !current ||
      !previous ||
      typeof current.animate !== 'function'
    ) {
      return
    }

    previous.scrollLeft = current.scrollLeft
    previous.scrollTop = current.scrollTop

    const animations: Array<Animation> = []
    const rootBounds = root.getBoundingClientRect()
    const previousByKey = new Map(
      Array.from(
        previous.querySelectorAll<HTMLElement>('[data-magic-key]'),
      ).map((element) => [element.dataset.magicKey, element]),
    )
    const matchedTokens = Array.from(
      current.querySelectorAll<HTMLElement>('[data-magic-key]'),
    ).flatMap((element) => {
      const previousElement = previousByKey.get(element.dataset.magicKey)
      if (!previousElement) {
        return []
      }
      return [
        {
          element,
          from: previousElement.getBoundingClientRect(),
          previousElement,
          to: element.getBoundingClientRect(),
        },
      ]
    })
    const enteringTokens = Array.from(
      current.querySelectorAll<HTMLElement>('[data-magic-enter]'),
    ).map((element) => ({
      bounds: element.getBoundingClientRect(),
      element,
    }))

    animations.push(
      previous.animate(
        [
          { opacity: 1, transform: 'translateY(0)' },
          { opacity: 0, transform: 'translateY(-3px)' },
        ],
        {
          duration: 680,
          easing: 'cubic-bezier(0.4, 0, 1, 1)',
          fill: 'forwards',
        },
      ),
    )

    for (const token of matchedTokens) {
      const { element, from, previousElement, to } = token
      const fromVisible = intersects(from, rootBounds)
      const toVisible = intersects(to, rootBounds)
      if (!toVisible) {
        continue
      }

      previousElement.style.visibility = 'hidden'
      if (!fromVisible) {
        animations.push(enterToken(element))
        continue
      }

      const deltaX = from.left - to.left
      const deltaY = from.top - to.top
      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) {
        continue
      }

      animations.push(
        element.animate(
          [
            {
              opacity: 0.72,
              transform: `translate(${deltaX}px, ${deltaY}px)`,
            },
            { opacity: 1, transform: 'translate(0, 0)' },
          ],
          {
            duration: transitionDuration,
            easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
            fill: 'both',
          },
        ),
      )
    }

    for (const { bounds, element } of enteringTokens) {
      if (!intersects(bounds, rootBounds)) {
        continue
      }

      animations.push(enterToken(element))
    }

    return () => {
      for (const animation of animations) {
        animation.cancel()
      }
    }
  }, [currentSource, previousSource, reducedMotion])

  return (
    <div
      ref={rootRef}
      className="dark relative h-full overflow-hidden bg-[#050a12]"
    >
      {previousSource && !reducedMotion ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden"
        >
          <CodeLayer
            ref={previousRef}
            aria-hidden="true"
            atoms={matched.previous}
            className="h-full overflow-hidden"
          />
        </div>
      ) : null}
      <CodeLayer
        ref={currentRef}
        atoms={matched.current}
        className="relative z-10 h-full overflow-auto"
      />
    </div>
  )
}

const CodeLayer = React.forwardRef<
  HTMLPreElement,
  {
    'aria-hidden'?: 'true'
    atoms: ReadonlyArray<CodeAtom>
    className: string
  }
>(function CodeLayer({ atoms, className, ...props }, ref) {
  return (
    <pre
      {...props}
      ref={ref}
      className={`m-0 whitespace-pre bg-transparent p-5 font-ds-mono text-ds-mono-2xs leading-[1.65] sm:p-7 sm:text-ds-mono-xs ${className}`}
      data-language="ts"
      style={{ color: 'var(--th-token)' }}
    >
      <code>{renderAtoms(atoms)}</code>
    </pre>
  )
})

function renderAtoms(atoms: ReadonlyArray<CodeAtom>) {
  return atoms.map((atom, index) => {
    if (atom.whitespace) {
      return (
        <React.Fragment key={`space:${index}`}>{atom.value}</React.Fragment>
      )
    }

    const className = atom.className
      ? `th-token th-${atom.className}`
      : undefined
    return (
      <span
        key={`${atom.matchKey ?? 'atom'}:${index}`}
        className={className}
        data-magic-enter={atom.enter ? '' : undefined}
        data-magic-key={atom.matchKey}
        style={{ display: 'inline-block' }}
      >
        {atom.value}
      </span>
    )
  })
}

function matchCodeAtoms(
  previousSource: string | undefined,
  currentSource: string,
): MatchedCode {
  const previous = previousSource ? tokenize(previousSource) : []
  const current = tokenize(currentSource)
  if (!previousSource) {
    return {
      current: current.map((atom) => ({ ...atom, enter: false })),
      previous,
    }
  }

  const previousLines = codeLines(previous)
  const currentLines = codeLines(current)
  let matchIndex = 0

  for (const [previousLine, currentLine] of matchCodeLines(
    previousLines,
    currentLines,
  )) {
    const changes = diffArrays(
      previousLine.atoms.map(({ atom }) => signature(atom)),
      currentLine.atoms.map(({ atom }) => signature(atom)),
    )
    let previousIndex = 0
    let currentIndex = 0

    for (const change of changes) {
      const count = change.value.length
      if (change.added) {
        currentIndex += count
        continue
      }
      if (change.removed) {
        previousIndex += count
        continue
      }

      for (let offset = 0; offset < count; offset += 1) {
        const previousAtom = previousLine.atoms[previousIndex + offset]
        const currentAtom = currentLine.atoms[currentIndex + offset]
        if (!previousAtom || !currentAtom) {
          continue
        }
        const matchKey = `token-${matchIndex}`
        previous[previousAtom.index] = {
          ...previousAtom.atom,
          matchKey,
        }
        current[currentAtom.index] = {
          ...currentAtom.atom,
          enter: false,
          matchKey,
        }
        matchIndex += 1
      }

      previousIndex += count
      currentIndex += count
    }
  }

  return { current, previous }
}

function tokenize(source: string): Array<CodeAtom> {
  const highlighted = defaultHighlighter.tokenize(source, { lang: 'ts' })
  const atoms: Array<CodeAtom> = []
  let line = 0

  for (const token of highlighted.tokens) {
    const parts = token.className
      ? (token.value.match(/\s+|\S+/g) ?? [])
      : (token.value.match(
          /\s+|[A-Za-z_$][\w$]*|\d+(?:\.\d+)?|===|!==|==|!=|=>|<=|>=|\+\+|--|&&|\|\||\?\?|\.{3}|./gs,
        ) ?? [])

    for (const value of parts) {
      const whitespace = /^\s+$/.test(value)
      atoms.push({
        className: token.className,
        enter: !whitespace,
        line,
        value,
        whitespace,
      })
      line += value.match(/\n/g)?.length ?? 0
    }
  }

  return atoms
}

function visibleAtoms(atoms: ReadonlyArray<CodeAtom>) {
  return atoms.flatMap((atom, index) =>
    atom.whitespace ? [] : [{ atom, index }],
  )
}

function codeLines(atoms: ReadonlyArray<CodeAtom>): Array<CodeLine> {
  const lines = new Map<number, Array<VisibleAtom>>()
  for (const visible of visibleAtoms(atoms)) {
    const line = lines.get(visible.atom.line) ?? []
    line.push(visible)
    lines.set(visible.atom.line, line)
  }
  return Array.from(lines, ([line, lineAtoms]) => ({
    atoms: lineAtoms,
    line,
  }))
}

function matchCodeLines(
  previous: ReadonlyArray<CodeLine>,
  current: ReadonlyArray<CodeLine>,
): Array<readonly [CodeLine, CodeLine]> {
  const pairs: Array<readonly [CodeLine, CodeLine]> = []
  const previousMatched = new Set<number>()
  const currentMatched = new Set<number>()
  const changes = diffArrays(
    previous.map(lineSignature),
    current.map(lineSignature),
  )
  let previousIndex = 0
  let currentIndex = 0

  for (const change of changes) {
    const count = change.value.length
    if (change.added) {
      currentIndex += count
      continue
    }
    if (change.removed) {
      previousIndex += count
      continue
    }

    for (let offset = 0; offset < count; offset += 1) {
      const previousLine = previous[previousIndex + offset]
      const currentLine = current[currentIndex + offset]
      if (!previousLine || !currentLine) {
        continue
      }
      pairs.push([previousLine, currentLine])
      previousMatched.add(previousLine.line)
      currentMatched.add(currentLine.line)
    }
    previousIndex += count
    currentIndex += count
  }

  const candidates = previous.flatMap((previousLine) =>
    previousMatched.has(previousLine.line)
      ? []
      : current.flatMap((currentLine) => {
          if (currentMatched.has(currentLine.line)) {
            return []
          }
          const similarity = lineSimilarity(previousLine, currentLine)
          return similarity >= 0.34
            ? [{ currentLine, previousLine, similarity }]
            : []
        }),
  )
  candidates.sort((left, right) => right.similarity - left.similarity)

  for (const candidate of candidates) {
    if (
      previousMatched.has(candidate.previousLine.line) ||
      currentMatched.has(candidate.currentLine.line)
    ) {
      continue
    }
    pairs.push([candidate.previousLine, candidate.currentLine])
    previousMatched.add(candidate.previousLine.line)
    currentMatched.add(candidate.currentLine.line)
  }

  return pairs
}

function lineSignature(line: CodeLine) {
  return line.atoms
    .map(({ atom }) =>
      signature({
        ...atom,
        value: atom.value.replace(/^kinetic[A-Za-z]+Chart$/, 'kineticChart'),
      }),
    )
    .join('\u0001')
}

function lineSimilarity(previous: CodeLine, current: CodeLine) {
  const previousAll = previous.atoms.map(({ atom }) => atom.value)
  const currentAll = current.atoms.map(({ atom }) => atom.value)
  const previousWords = previousAll.filter(isWordToken)
  const currentWords = currentAll.filter(isWordToken)
  const wordScore = diceCoefficient(previousWords, currentWords)
  if (wordScore === 0) {
    return 0
  }
  const tokenScore = diceCoefficient(previousAll, currentAll)
  const distance = Math.abs(previous.line - current.line)
  const positionBonus = Math.max(0, 0.08 - distance * 0.004)
  return wordScore * 0.68 + tokenScore * 0.32 + positionBonus
}

function diceCoefficient(
  previous: ReadonlyArray<string>,
  current: ReadonlyArray<string>,
) {
  if (previous.length === 0 || current.length === 0) {
    return 0
  }
  const available = new Map<string, number>()
  for (const value of previous) {
    available.set(value, (available.get(value) ?? 0) + 1)
  }
  let intersection = 0
  for (const value of current) {
    const count = available.get(value) ?? 0
    if (count > 0) {
      intersection += 1
      available.set(value, count - 1)
    }
  }
  return (2 * intersection) / (previous.length + current.length)
}

function isWordToken(value: string) {
  return /[A-Za-z0-9_$'"]/.test(value)
}

function signature(atom: CodeAtom) {
  return `${atom.className ?? ''}\u0000${atom.value}`
}

function intersects(first: DOMRect, second: DOMRect) {
  return !(
    first.bottom < second.top ||
    first.top > second.bottom ||
    first.right < second.left ||
    first.left > second.right
  )
}

function enterToken(element: HTMLElement) {
  return element.animate(
    [
      { opacity: 0, transform: 'translateY(6px) scale(0.96)' },
      { opacity: 1, transform: 'translateY(0) scale(1)' },
    ],
    {
      delay: 180,
      duration: 520,
      easing: 'cubic-bezier(0.34, 1.2, 0.64, 1)',
      fill: 'both',
    },
  )
}
