import { z } from 'zod'
import { packageComparisonSchema } from './index'

export function getPopularComparisons(): z.input<
  typeof packageComparisonSchema
>[] {
  return [
    {
      title: 'Data Fetching',
      packageGroups: [
        {
          packages: [
            { name: '@tanstack/react-query' },
            { name: 'react-query' },
          ],
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
      ],
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
        {
          packages: [
            {
              name: 'react',
              hidden: true,
            },
          ],
          baseline: true,
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
  ] as const
}
