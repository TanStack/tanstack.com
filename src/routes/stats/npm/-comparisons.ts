import * as v from 'valibot'
import { npmPackageNameSchema } from '~/utils/schemas'
import {
  MAX_NPM_STATS_GROUPS,
  MAX_NPM_STATS_PACKAGES_PER_GROUP,
  MAX_NPM_STATS_TOTAL_PACKAGES,
} from '~/utils/npm-stats-limits'
import { tanStackTotalNpmStatsPackageGroup } from '~/utils/tanstack-npm-stats'

export const packageGroupSchema = v.object({
  label: v.optional(v.pipe(v.string(), v.maxLength(80))),
  hidden: v.optional(v.boolean()),
  packages: v.pipe(
    v.array(
      v.object({
        name: npmPackageNameSchema,
        hidden: v.optional(v.boolean()),
      }),
    ),
    v.maxLength(MAX_NPM_STATS_PACKAGES_PER_GROUP),
  ),
  color: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(32)))),
  baseline: v.optional(v.boolean()),
  baselineLabel: v.optional(v.pipe(v.string(), v.maxLength(80))),
})

export const packageGroupsSchema = v.pipe(
  v.array(packageGroupSchema),
  v.maxLength(MAX_NPM_STATS_GROUPS),
  v.check(
    (groups) =>
      groups.reduce((count, group) => count + group.packages.length, 0) <=
      MAX_NPM_STATS_TOTAL_PACKAGES,
    `NPM stats comparisons support up to ${MAX_NPM_STATS_TOTAL_PACKAGES} total packages.`,
  ),
)

export const packageComparisonSchema = v.object({
  title: v.pipe(v.string(), v.maxLength(120)),
  packageGroups: packageGroupsSchema,
  baseline: v.optional(v.string()),
})

type PackageGroupInput = v.InferInput<typeof packageGroupSchema>

export type BaselinePreset = {
  id: string
  title: string
  description: string
  category: 'single' | 'index'
  packages: Array<{ name: string; color?: string }>
}

export function getBaselinePresets(): BaselinePreset[] {
  return [
    // Single-package presets — direct comparison against a familiar reference.
    {
      id: 'react',
      title: 'React',
      description: 'Compare against React downloads.',
      category: 'single',
      packages: [{ name: 'react', color: '#61DAFB' }],
    },
    {
      id: 'vue',
      title: 'Vue',
      description: 'Compare against Vue downloads.',
      category: 'single',
      packages: [{ name: 'vue', color: '#41B883' }],
    },
    {
      id: 'angular',
      title: 'Angular',
      description: 'Compare against Angular core downloads.',
      category: 'single',
      packages: [{ name: '@angular/core', color: '#DD0031' }],
    },
    {
      id: 'svelte',
      title: 'Svelte',
      description: 'Compare against Svelte downloads.',
      category: 'single',
      packages: [{ name: 'svelte', color: '#FF3E00' }],
    },
    {
      id: 'typescript',
      title: 'TypeScript',
      description: 'Compare against TypeScript downloads.',
      category: 'single',
      packages: [{ name: 'typescript', color: '#3178C6' }],
    },
    {
      id: 'lodash',
      title: 'Lodash',
      description: 'Compare against Lodash downloads.',
      category: 'single',
      packages: [{ name: 'lodash', color: '#3492FF' }],
    },
    {
      id: 'express',
      title: 'Express',
      description: 'Compare against Express downloads.',
      category: 'single',
      packages: [{ name: 'express', color: '#000000' }],
    },
    // Multi-package indexes — equal-weighted (each member contributes its
    // growth rate equally regardless of size) so the largest member can't
    // dominate the line shape.
    {
      id: 'npm-ecosystem',
      title: 'NPM Ecosystem (index)',
      description:
        'Equal-weighted growth index across foundational packages: lodash, typescript, express, axios. Each contributes its growth rate equally.',
      category: 'index',
      packages: [
        { name: 'lodash', color: '#3492FF' },
        { name: 'typescript', color: '#3178C6' },
        { name: 'express', color: '#000000' },
        { name: 'axios', color: '#5A29E4' },
      ],
    },
    {
      id: 'frontend-frameworks',
      title: 'Frontend Frameworks (index)',
      description:
        'Equal-weighted growth index across the major UI frameworks: react, vue, angular, svelte, solid-js.',
      category: 'index',
      packages: [
        { name: 'react', color: '#61DAFB' },
        { name: 'vue', color: '#41B883' },
        { name: '@angular/core', color: '#DD0031' },
        { name: 'svelte', color: '#FF3E00' },
        { name: 'solid-js', color: '#2C4F7C' },
      ],
    },
  ]
}

const dataFetchingPackageGroups = [
  {
    packages: [{ name: '@tanstack/react-query' }, { name: 'react-query' }],
    color: '#FF4500',
  },
  {
    packages: [{ name: 'swr' }],
    color: '#ec4899',
  },
  {
    packages: [{ name: '@apollo/client' }],
    color: '#6B46C1',
  },
  {
    packages: [{ name: '@trpc/client' }],
    color: '#2596BE',
  },
] satisfies PackageGroupInput[]

const tanstackLibraryPackageGroups = [
  {
    label: 'TanStack Query',
    packages: [{ name: '@tanstack/query-core' }, { name: 'react-query' }],
    color: '#FF4500',
  },
  {
    label: 'TanStack Table',
    packages: [{ name: '@tanstack/table-core' }, { name: 'react-table' }],
    color: '#FF7043',
  },
  {
    label: 'TanStack Router',
    packages: [{ name: '@tanstack/router-core' }, { name: 'react-location' }],
    color: '#32CD32',
  },
  {
    label: 'TanStack Start',
    packages: [{ name: '@tanstack/start-client-core' }],
    color: '#00CED1',
  },
  {
    label: 'TanStack Form',
    packages: [{ name: '@tanstack/form-core' }],
    color: '#FFD700',
  },
  {
    label: 'TanStack Virtual',
    packages: [{ name: '@tanstack/virtual-core' }, { name: 'react-virtual' }],
    color: '#8B5CF6',
  },
  {
    label: 'TanStack DB',
    packages: [{ name: '@tanstack/db' }],
    color: '#F97316',
  },
  {
    label: 'TanStack Pacer',
    packages: [{ name: '@tanstack/pacer' }, { name: '@tanstack/pacer-lite' }],
    color: '#84CC16',
  },
  {
    label: 'TanStack AI',
    packages: [{ name: '@tanstack/ai' }],
    color: '#EC4899',
  },
  {
    label: 'TanStack Intent',
    packages: [{ name: '@tanstack/intent' }],
    color: '#0EA5E9',
  },
  {
    label: 'TanStack Store',
    packages: [{ name: '@tanstack/store' }],
    color: '#B89A56',
  },
  {
    label: 'TanStack Hotkeys',
    packages: [{ name: '@tanstack/hotkeys' }],
    color: '#F43F5E',
  },
  {
    label: 'TanStack Ranger',
    packages: [{ name: '@tanstack/ranger' }, { name: 'react-ranger' }],
    color: '#1F2937',
  },
  {
    label: 'TanStack Config',
    packages: [{ name: '@tanstack/config' }],
    color: '#1F2937',
  },
  {
    label: 'TanStack Devtools',
    packages: [{ name: '@tanstack/devtools' }],
    color: '#1F2937',
  },
  {
    label: 'TanStack CLI',
    packages: [{ name: '@tanstack/cli' }],
    color: '#6366F1',
  },
] satisfies PackageGroupInput[]

const tanstackAggregatePackageGroup =
  tanStackTotalNpmStatsPackageGroup satisfies PackageGroupInput

const ecosystemTanStackPackageGroups = [
  {
    label: 'TanStack Query',
    packages: [{ name: '@tanstack/query-core' }, { name: 'react-query' }],
    color: '#FF4500',
  },
  {
    label: 'TanStack Table',
    packages: [{ name: '@tanstack/table-core' }, { name: 'react-table' }],
    color: '#FF7043',
  },
  {
    label: 'TanStack Router',
    packages: [{ name: '@tanstack/router-core' }],
    color: '#32CD32',
  },
  {
    label: 'TanStack Start',
    packages: [{ name: '@tanstack/start-client-core' }],
    color: '#00CED1',
  },
  {
    label: 'TanStack Form',
    packages: [{ name: '@tanstack/form-core' }],
    color: '#FFD700',
  },
  {
    label: 'TanStack Virtual',
    packages: [{ name: '@tanstack/virtual-core' }, { name: 'react-virtual' }],
    color: '#8B5CF6',
  },
  {
    label: 'TanStack DB',
    packages: [{ name: '@tanstack/db' }],
    color: '#F97316',
  },
  {
    label: 'TanStack Pacer',
    packages: [{ name: '@tanstack/pacer' }],
    color: '#84CC16',
  },
  {
    label: 'TanStack AI',
    packages: [{ name: '@tanstack/ai' }],
    color: '#EC4899',
  },
  {
    label: 'TanStack Intent',
    packages: [{ name: '@tanstack/intent' }],
    color: '#0EA5E9',
  },
  {
    label: 'TanStack Store',
    packages: [{ name: '@tanstack/store' }],
    color: '#B89A56',
  },
] satisfies PackageGroupInput[]

const ecosystemComparisonPackageGroups = [
  {
    label: 'TanStack',
    packages: [
      { name: '@tanstack/query-core' },
      { name: 'react-query' },
      { name: '@tanstack/table-core' },
      { name: 'react-table' },
      { name: '@tanstack/router-core' },
      { name: '@tanstack/start-client-core' },
      { name: '@tanstack/form-core' },
      { name: '@tanstack/virtual-core' },
      { name: 'react-virtual' },
      { name: '@tanstack/db' },
      { name: '@tanstack/pacer' },
      { name: '@tanstack/ai' },
      { name: '@tanstack/intent' },
      { name: '@tanstack/store', hidden: true },
    ],
    color: '#01a7b9',
  },
  {
    label: 'Next.js',
    packages: [{ name: 'next' }, { name: 'ai' }, { name: 'workflow' }],
    color: '#6d6a6a',
  },
  {
    label: 'React Router',
    packages: [
      { name: 'react-router' },
      { name: '@remix-run/react' },
      { name: 'remix' },
    ],
    color: '#ff7580',
  },
  {
    label: 'Astro',
    packages: [{ name: 'astro' }],
    color: '#BC52EE',
  },
  {
    label: 'Vue',
    packages: [{ name: 'vue' }],
    color: '#6aaf04',
  },
  {
    label: 'Angular',
    packages: [{ name: '@angular/core' }, { name: 'angular' }],
    color: '#DD0031',
  },
  {
    label: 'Expo',
    packages: [{ name: 'expo' }],
    color: '#F59E0B',
  },
  {
    packages: [{ name: 'svelte' }],
  },
  {
    packages: [{ name: 'vite' }],
  },
  {
    label: 'React',
    packages: [{ name: 'react', hidden: true }],
    color: '#61DAFB',
    baseline: true,
    baselineLabel: 'React',
  },
] satisfies PackageGroupInput[]

// Default comparison for route validation.
export const defaultPackageGroups = ecosystemComparisonPackageGroups

const ecosystemFlattenedPackageGroups = [
  ...ecosystemTanStackPackageGroups,
  {
    label: 'Next.js',
    packages: [{ name: 'next' }],
    color: '#6d6a6a',
  },
  {
    label: 'AI SDK',
    packages: [{ name: 'ai' }],
    color: '#111827',
  },
  {
    label: 'Workflow',
    packages: [{ name: 'workflow' }],
    color: '#9CA3AF',
  },
  {
    label: 'React Router',
    packages: [{ name: 'react-router' }],
    color: '#ff7580',
  },
  {
    label: 'Remix React',
    packages: [{ name: '@remix-run/react' }],
    color: '#EC4899',
  },
  {
    label: 'Remix',
    packages: [{ name: 'remix' }],
    color: '#F97316',
  },
  {
    label: 'Astro',
    packages: [{ name: 'astro' }],
    color: '#BC52EE',
  },
  {
    label: 'Vue',
    packages: [{ name: 'vue' }],
    color: '#6aaf04',
  },
  {
    label: 'Angular',
    packages: [{ name: '@angular/core' }, { name: 'angular' }],
    color: '#DD0031',
  },
  {
    label: 'Expo',
    packages: [{ name: 'expo' }],
    color: '#F59E0B',
  },
  {
    label: 'Svelte',
    packages: [{ name: 'svelte' }],
  },
  {
    label: 'Vite',
    packages: [{ name: 'vite' }],
  },
  {
    label: 'React',
    packages: [{ name: 'react', hidden: true }],
    color: '#61DAFB',
    baseline: true,
    baselineLabel: 'React',
  },
] satisfies PackageGroupInput[]

export function getPopularComparisons(): v.InferInput<
  typeof packageComparisonSchema
>[] {
  return [
    {
      title: 'JavaScript Ecosystem',
      packageGroups: ecosystemComparisonPackageGroups,
    },
    {
      title: 'JavaScript Ecosystem (flat)',
      packageGroups: ecosystemFlattenedPackageGroups,
    },
    {
      title: 'TanStack Total',
      packageGroups: [tanstackAggregatePackageGroup],
    },
    {
      title: 'TanStack Libraries',
      packageGroups: tanstackLibraryPackageGroups,
    },
    {
      title: 'Data Fetching',
      packageGroups: dataFetchingPackageGroups,
    },
    {
      title: 'State Management',
      packageGroups: [
        {
          packages: [{ name: 'redux' }],
          color: '#764ABC',
        },
        {
          packages: [{ name: 'mobx' }],
          color: '#FF9955',
        },
        {
          packages: [{ name: 'zustand' }],
          color: '#764ABC',
        },
        {
          packages: [{ name: 'jotai' }],
          color: '#6366f1',
        },
        {
          packages: [{ name: 'valtio' }],
          color: '#FF6B6B',
        },
        {
          packages: [{ name: '@tanstack/store' }],
          color: '#FF69B4',
        },
        {
          packages: [
            { name: '@tanstack/react-query' },
            { name: 'react-query' },
          ],
          color: '#FF4500',
        },
      ],
    },
    {
      title: 'Routing (React)',
      packageGroups: [
        {
          packages: [{ name: 'react-router' }],
          color: '#FF0000',
        },
        {
          packages: [{ name: '@tanstack/react-router' }],
          color: '#32CD32',
        },
        {
          packages: [{ name: 'next' }],
          color: '#4682B4',
        },
        {
          packages: [{ name: 'wouter' }],
          color: '#8b5cf6',
        },
        {
          packages: [{ name: 'expo' }],
          color: '#f59e0b',
        },
      ],
    },
    {
      title: 'AI & Agent Harnesses',
      packageGroups: [
        {
          label: 'TanStack AI',
          packages: [{ name: '@tanstack/ai' }],
          color: '#EC4899',
        },
        {
          label: 'AI SDK',
          packages: [{ name: 'ai' }],
          color: '#111827',
        },
        {
          label: 'LangChain',
          packages: [{ name: 'langchain' }],
          color: '#1C3C3C',
        },
        {
          label: 'LangGraph',
          packages: [{ name: '@langchain/langgraph' }],
          color: '#2E8B57',
        },
        {
          label: 'Mastra',
          packages: [{ name: '@mastra/core' }],
          color: '#7C3AED',
        },
        {
          label: 'OpenAI Agents',
          packages: [{ name: '@openai/agents' }],
          color: '#10A37F',
        },
        {
          label: 'Genkit',
          packages: [{ name: 'genkit' }],
          color: '#4285F4',
        },
        {
          label: 'CopilotKit',
          packages: [{ name: '@copilotkit/react-core' }],
          color: '#F97316',
        },
        {
          label: 'Promptfoo',
          packages: [{ name: 'promptfoo' }],
          color: '#FACC15',
        },
      ],
    },
    {
      title: 'Data Grids',
      packageGroups: [
        {
          packages: [
            { name: 'ag-grid-community' },
            { name: 'ag-grid-enterprise' },
          ],
          color: '#29B6F6',
        },
        {
          packages: [
            { name: '@tanstack/react-table' },
            { name: 'react-table' },
          ],
          color: '#FF7043',
        },
        {
          packages: [{ name: 'handsontable' }],
          color: '#FFCA28',
        },
        {
          packages: [{ name: '@mui/x-data-grid' }, { name: 'mui-datatables' }],
          color: '#1976D2',
        },
        {
          packages: [{ name: 'react-data-grid' }],
          color: '#4CAF50',
        },
      ],
    },
    {
      title: 'Virtualization',
      packageGroups: [
        {
          packages: [{ name: 'react-virtualized' }],
          color: '#FF6B6B',
        },
        {
          packages: [{ name: 'react-window' }],
          color: '#4ECDC4',
        },
        {
          packages: [
            { name: '@tanstack/react-virtual' },
            { name: 'react-virtual' },
          ],
          color: '#FF4500',
        },
        {
          packages: [{ name: 'react-lazyload' }],
          color: '#FFD93D',
        },
        {
          packages: [{ name: 'virtua' }],
          color: '#6C5CE7',
        },
        {
          packages: [{ name: 'react-virtuoso' }],
          color: '#00B894',
        },
      ],
    },
    {
      title: 'Frameworks',
      packageGroups: [
        {
          packages: [{ name: 'react' }],
          color: '#61DAFB',
        },
        {
          packages: [{ name: 'vue' }],
          color: '#41B883',
        },
        {
          packages: [{ name: '@angular/core' }],
          color: '#DD0031',
        },
        {
          packages: [{ name: 'svelte' }],
          color: '#FF3E00',
        },
        {
          packages: [{ name: 'solid-js' }],
          color: '#2C4F7C',
        },
        {
          packages: [{ name: 'preact' }],
          color: '#673AB8',
        },
      ],
    },
    {
      title: 'Styling',
      packageGroups: [
        {
          packages: [{ name: 'tailwindcss' }],
          color: '#06B6D4',
        },
        {
          packages: [{ name: 'bootstrap' }],
          color: '#7952B3',
        },
        {
          packages: [{ name: '@emotion/react' }],
          color: '#D36AC2',
        },
        {
          packages: [{ name: '@stitches/react' }],
          color: '#8b5cf6',
        },
        {
          packages: [{ name: '@vanilla-extract/css' }],
          color: '#FFB6C1',
        },
      ],
    },
    {
      title: 'Build Tools',
      packageGroups: [
        {
          packages: [{ name: 'webpack' }],
          color: '#8DD6F9',
        },
        {
          packages: [{ name: 'vite' }],
          color: '#008000',
        },
        {
          packages: [{ name: 'rollup' }],
          color: '#e80A3F',
        },
        {
          packages: [{ name: 'rolldown' }],
          color: '#FF5733',
        },
        {
          packages: [{ name: 'esbuild' }],
          color: '#FFCF00',
        },
        {
          packages: [{ name: '@swc/core' }],
          color: '#DEAD0F',
        },
        {
          packages: [{ name: 'parcel' }],
          color: '#2D8CFF',
        },
        {
          packages: [{ name: '@rspack/core' }],
          color: '#8DD6F9',
        },
      ],
    },
    {
      title: 'Testing',
      packageGroups: [
        {
          packages: [{ name: 'jest' }],
          color: '#C21325',
        },
        {
          packages: [{ name: 'vitest' }],
          color: '#646CFF',
        },
        {
          packages: [{ name: '@testing-library/react' }],
          color: '#E33332',
        },
        {
          packages: [{ name: 'cypress' }],
          color: '#4A5568',
        },
        {
          packages: [{ name: 'playwright' }],
          color: '#2EAD33',
        },
        {
          packages: [{ name: '@storybook/react' }],
          color: '#FF4785',
        },
      ],
    },
    {
      title: 'Forms',
      packageGroups: [
        {
          packages: [{ name: 'react-hook-form' }],
          color: '#EC5990',
        },
        {
          packages: [{ name: '@tanstack/form-core' }],
          color: '#FFD700',
        },
        {
          packages: [{ name: '@conform-to/dom' }],
          color: '#FF5733',
        },
        {
          packages: [
            { name: '@formisch/react' },
            { name: '@formisch/svelte' },
            { name: '@formisch/solid' },
            { name: '@formisch/vue' },
            { name: '@formisch/preact' },
            { name: '@formisch/qwik' },
          ],
          color: '#8B5CF6',
        },
      ],
    },
    {
      title: 'UI Components',
      packageGroups: [
        {
          packages: [{ name: '@mui/material' }],
          color: '#0081CB',
        },
        {
          packages: [{ name: '@chakra-ui/react' }],
          color: '#319795',
        },
        {
          packages: [{ name: '@radix-ui/themes' }],
          color: '#FF6F61',
        },
        {
          packages: [{ name: '@headlessui/react' }],
          color: '#f43f5e',
        },
        {
          packages: [{ name: '@mantine/core' }],
          color: '#FFD700',
        },
      ],
    },
    {
      title: 'Animation',
      packageGroups: [
        {
          packages: [{ name: 'motion' }, { name: 'framer-motion' }],
          color: '#FF0055',
        },
        {
          packages: [{ name: 'react-spring' }],
          color: '#FF7F50',
        },
        {
          packages: [{ name: '@react-spring/web' }],
          color: '#FF4500',
        },
        {
          packages: [{ name: 'gsap' }],
          color: '#32CD32',
        },
        {
          packages: [{ name: '@motionone/dom' }],
          color: '#FF1493',
        },
        {
          packages: [{ name: '@formkit/auto-animate' }],
          color: '#FFD700',
        },
      ],
    },
    {
      title: 'Date & Time',
      packageGroups: [
        {
          packages: [{ name: 'date-fns' }],
          color: '#E91E63',
        },
        {
          packages: [{ name: 'dayjs' }],
          color: '#FF6B6B',
        },
        {
          packages: [{ name: 'luxon' }],
          color: '#3498DB',
        },
        {
          packages: [{ name: 'moment' }],
          color: '#4A5568',
        },
        {
          packages: [{ name: '@date-io/date-fns' }],
          color: '#FFD700',
        },
        {
          packages: [{ name: 'temporal-polyfill' }],
          color: '#a855f7',
        },
      ],
    },
    {
      title: 'Validation',
      packageGroups: [
        {
          packages: [{ name: 'zod' }],
          color: '#ef4444',
        },
        {
          packages: [{ name: 'io-ts' }],
          color: '#3b82f6',
        },
        {
          packages: [{ name: 'arktype' }],
          color: '#10b981',
        },
        {
          packages: [{ name: 'valibot' }],
          color: '#f97316',
        },
        {
          packages: [{ name: 'yup' }],
          color: '#06b6d4',
        },
        {
          packages: [{ name: '@sinclair/typebox' }],
          color: '#d946ef',
        },
      ],
    },
    {
      title: 'Documentation',
      packageGroups: [
        {
          packages: [{ name: 'vitepress' }],
          color: '#a8b1ff',
        },
        {
          packages: [{ name: '@docusaurus/core' }],
          color: '#21b091',
        },
        {
          packages: [{ name: 'vocs' }],
          color: '#0090ff',
        },
        {
          packages: [{ name: '@astrojs/starlight' }],
          color: '#f97316',
        },
        {
          packages: [{ name: 'nextra' }],
          color: '#00CED1',
        },
        {
          packages: [{ name: 'fumadocs-core' }],
          color: '#DA70D6',
        },
      ],
    },
    {
      title: 'Drag & Drop',
      packageGroups: [
        {
          label: 'dnd-kit',
          packages: [{ name: '@dnd-kit/core' }],
          color: '#eb2f06',
        },
        {
          label: 'Pragmatic DnD',
          packages: [{ name: '@atlaskit/pragmatic-drag-and-drop' }],
          color: '#0652dd',
        },
        {
          label: 'React DnD',
          packages: [{ name: 'react-dnd' }],
          color: '#10ac84',
        },
        {
          label: 'SortableJS',
          packages: [
            { name: 'sortablejs' },
            { name: 'react-sortablejs' },
            { name: 'vuedraggable' },
            { name: 'vue-draggable-next' },
            { name: 'vue-draggable-plus' },
          ],
          color: '#f39c12',
        },
        {
          label: 'Hello Pangea DnD',
          packages: [
            { name: '@hello-pangea/dnd' },
            { name: 'react-beautiful-dnd' },
          ],
          color: '#8854d0',
        },
        {
          label: 'React Draggable',
          packages: [{ name: 'react-draggable' }],
          color: '#20bf6b',
        },
        {
          label: 'React Grid Layout',
          packages: [{ name: 'react-grid-layout' }],
          color: '#d81b60',
        },
        {
          label: 'React Rnd',
          packages: [{ name: 'react-rnd' }],
          color: '#a55d35',
        },
      ],
    },
  ] as const
}
