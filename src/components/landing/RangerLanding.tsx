import * as React from 'react'
import { useParams } from '@tanstack/react-router'
import {
  Gauge,
  GitBranch,
  ArrowsHorizontal,
  Ruler,
  SlidersHorizontal,
  Sparkle,
} from '@phosphor-icons/react'

import { StackBlitzSection } from '~/components/StackBlitzSection'
import { getBranch, getLibrary } from '~/libraries'
import { rangerProject } from '~/libraries/ranger'
import {
  LibraryLanding,
  type LibraryLandingConfig,
} from '~/components/landing/LibraryLanding'

const library = getLibrary('ranger')

const rangerAgentPrompt = [
  'Build a custom range or multi-range slider with TanStack Ranger.',
  'Keep the slider headless: own the markup, track, ticks, labels, thumbs, formatting, and accessibility while using Ranger for range math and thumb interaction state.',
  'Show min/max, steps, multiple thumbs, constrained movement, and product-specific styling.',
].join(' ')

const rangeSteps = [
  {
    label: 'Values',
    body: 'Start with one value, two bounds, or a set of range handles.',
  },
  {
    label: 'Track',
    body: 'Map percentages and segments into your own track UI.',
  },
  {
    label: 'Thumbs',
    body: 'Render handles with labels, tooltips, constraints, and focus state.',
  },
  {
    label: 'Commit',
    body: 'Send final values into filters, charts, editors, or forms.',
  },
]

export default function RangerLanding() {
  const { version } = useParams({ strict: false })
  const resolvedVersion = version ?? library.latestVersion
  const branch = getBranch(rangerProject, resolvedVersion)

  const config: LibraryLandingConfig = {
    libraryId: 'ranger',
    hero: {
      kicker: {
        icon: <ArrowsHorizontal size={14} />,
        text: 'Headless range controls',
      },
      tagline: 'Build the slider your product actually needs.',
      description:
        'Ranger provides headless primitives for range and multi-range sliders, leaving the track, thumbs, labels, ticks, and product UI completely under your control.',
      prompt: rangerAgentPrompt,
      promptLabel: 'Copy Ranger Prompt',
      proof: [
        { label: 'Headless track', value: 'bring your own UI and semantics' },
        { label: 'Multi-thumb', value: 'ranges, bounds, steps, constraints' },
        { label: 'React hooks', value: 'range math without a slider skin' },
      ],
      panel: <RangerLabPanel />,
    },
    why: {
      kicker: { icon: <Sparkle size={14} />, text: 'Why Ranger' },
      heading: 'Range controls are small until the product gets specific.',
      intro:
        'Once a slider needs multiple thumbs, custom labels, controlled values, meaningful ticks, and a design system skin, a prebuilt UI becomes the wrong abstraction. Ranger keeps the hard math below your component.',
      features: [
        {
          title: 'The slider is yours.',
          body: 'Ranger gives interaction state and range math without rendering the track, thumbs, labels, or layout for you.',
          icon: <SlidersHorizontal size={18} />,
        },
        {
          title: 'Multi-range without bespoke math.',
          body: 'Build price filters, timelines, editors, split ranges, or multi-thumb controls with bounds and steps handled predictably.',
          icon: <ArrowsHorizontal size={18} />,
        },
        {
          title: 'Ticks and labels can be product-specific.',
          body: 'Display percentages, dates, currency, logarithmic labels, marks, or custom annotations from the same headless primitives.',
          icon: <Ruler size={18} />,
        },
        {
          title: 'Small utility, high inversion of control.',
          body: 'Ranger is useful precisely because it does not become your design system. It stays under the component you actually need.',
          icon: <Gauge size={18} />,
        },
      ],
    },
    sections: [
      {
        kicker: { icon: <GitBranch size={14} />, text: 'Slider lifecycle' },
        heading: 'Values in, product-specific control out.',
        body: 'Ranger helps translate values into interactive geometry. Your app decides what those values mean and how the user should see them.',
        panel: <StepPanel />,
        side: 'left',
      },
    ],
    interlude: (
      <StackBlitzSection
        project={rangerProject}
        branch={branch}
        examplePath="examples/${framework}/basic"
        title="tannerlinsley/react-ranger: basic"
      />
    ),
    ecosystem: {
      heading: 'Ranger stays small so your component can be specific.',
      body: 'Maintainers, examples, partners, and GitHub sponsors keep the headless range primitive useful without turning it into a UI kit.',
    },
  }

  return <LibraryLanding config={config} />
}

function RangerLabPanel() {
  const [values, setValues] = React.useState<Array<number>>([120, 310, 640])
  const sortedValues = [...values].sort((a, b) => a - b)
  const updateValue = (index: number, nextValue: number) => {
    setValues((current) => {
      const minValue = index > 0 ? current[index - 1] + 10 : 0
      const maxValue =
        index < current.length - 1 ? current[index + 1] - 10 : 1000
      const nextValues = current.map((value, valueIndex) =>
        valueIndex === index
          ? Math.min(Math.max(nextValue, minValue), maxValue)
          : value,
      )

      return nextValues
    })
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-zinc-300 bg-white p-4 shadow-sm shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-md bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-md bg-yellow-400" />
          <span className="h-2.5 w-2.5 rounded-md bg-emerald-400" />
        </div>
        <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
          multi-range slider
        </span>
      </div>

      <div className="mt-8 px-2">
        <div className="relative h-4 rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className="absolute top-0 h-4 rounded-full bg-zinc-950 dark:bg-white"
            style={{
              left: `${sortedValues[0] / 10}%`,
              right: `${100 - sortedValues[sortedValues.length - 1] / 10}%`,
            }}
          />
          {values.map((value, index) => (
            <div
              key={index}
              className="absolute top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-zinc-950 shadow-md dark:border-zinc-950 dark:bg-white"
              style={{ left: `${value / 10}%` }}
            >
              <span className="absolute left-1/2 top-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-950 px-2 py-1 text-xs font-black text-white dark:bg-white dark:text-zinc-950">
                ${value}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-16 grid grid-cols-5 text-center text-xs font-bold text-zinc-500 dark:text-zinc-400">
          {['0', '250', '500', '750', '1000'].map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-2">
        {values.map((value, index) => (
          <label key={index} className="grid gap-1">
            <span className="text-[0.65rem] font-black uppercase text-zinc-500 dark:text-zinc-400">
              Handle {index + 1}
            </span>
            <input
              className="accent-zinc-950 dark:accent-white"
              max={1000}
              min={0}
              step={10}
              type="range"
              value={value}
              onChange={(event) =>
                updateValue(index, event.currentTarget.valueAsNumber)
              }
            />
          </label>
        ))}
      </div>

      <div className="mt-6 rounded-lg bg-zinc-950 p-4 text-sm text-zinc-100 dark:bg-black">
        <p className="font-mono leading-6">
          useRanger({'{'} getRangerElement: () =&gt; rangerRef.current,
          <br />
          &nbsp;&nbsp;min: 0, max: 1000,
          <br />
          &nbsp;&nbsp;stepSize: 10, values: [{values.join(', ')}],
          <br />
          &nbsp;&nbsp;onChange: instance =&gt; setValues(instance.sortedValues){' '}
          {'}'})
        </p>
      </div>
    </div>
  )
}

function StepPanel() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rangeSteps.map((step, index) => (
        <div
          key={step.label}
          className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-950 text-sm font-black text-white dark:bg-white dark:text-zinc-950">
            {index + 1}
          </span>
          <h3 className="mt-4 text-lg font-black leading-tight">
            {step.label}
          </h3>
          <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            {step.body}
          </p>
        </div>
      ))}
    </div>
  )
}
