export type PackageComparison = {
  title: string
  packages: Array<{
    packages: string[]
    color: string
  }>
}

export function getPopularComparisons(): PackageComparison[] {
  return [
    {
      title: 'Data Fetching',
      packages: [
        {
          packages: ['@tanstack/react-query', 'react-query'],
          color: '#FF4500',
        },
        {
          packages: ['swr'],
          color: '#ec4899',
        },
        {
          packages: ['@apollo/client'],
          color: '#6B46C1',
        },
        {
          packages: ['@trpc/client'],
          color: '#2596BE',
        },
      ],
    },
    {
      title: 'State Management',
      packages: [
        {
          packages: ['redux'],
          color: '#764ABC',
        },
        {
          packages: ['mobx'],
          color: '#FF9955',
        },
        {
          packages: ['zustand'],
          color: '#764ABC',
        },
        {
          packages: ['jotai'],
          color: '#6366f1',
        },
        {
          packages: ['valtio'],
          color: '#FF6B6B',
        },
        {
          packages: ['@tanstack/react-query', 'react-query'],
          color: '#FF4500',
        },
      ],
    },
    {
      title: 'Table/Grid Libraries',
      packages: [
        {
          packages: ['ag-grid-community', 'ag-grid-enterprise'],
          color: '#29B6F6',
        },
        {
          packages: ['@tanstack/react-table', 'react-table'],
          color: '#FF7043',
        },
        {
          packages: ['handsontable'],
          color: '#FFCA28',
        },
        {
          packages: ['@mui/x-data-grid', 'mui-datatables'],
          color: '#1976D2',
        },
        {
          packages: ['react-data-grid'],
          color: '#4CAF50',
        },
      ],
    },
    {
      title: 'Virtualization Libraries',
      packages: [
        {
          packages: ['react-virtualized'],
          color: '#FF6B6B',
        },
        {
          packages: ['react-window'],
          color: '#4ECDC4',
        },
        {
          packages: ['@tanstack/react-virtual', 'react-virtual'],
          color: '#FF4500',
        },
        {
          packages: ['react-lazyload'],
          color: '#FFD93D',
        },
        {
          packages: ['virtua'],
          color: '#6C5CE7',
        },
        {
          packages: ['react-virtuoso'],
          color: '#00B894',
        },
      ],
    },
    {
      title: 'UI Frameworks',
      packages: [
        {
          packages: ['react'],
          color: '#61DAFB',
        },
        {
          packages: ['vue'],
          color: '#41B883',
        },
        {
          packages: ['@angular/core'],
          color: '#DD0031',
        },
        {
          packages: ['svelte'],
          color: '#FF3E00',
        },
        {
          packages: ['preact'],
          color: '#673AB8',
        },
      ],
    },
    {
      title: 'CSS Frameworks',
      packages: [
        {
          packages: ['tailwindcss'],
          color: '#06B6D4',
        },
        {
          packages: ['bootstrap'],
          color: '#7952B3',
        },
        {
          packages: ['@emotion/react'],
          color: '#D36AC2',
        },
        {
          packages: ['@stitches/react'],
          color: '#8b5cf6',
        },
        {
          packages: ['@vanilla-extract/css'],
          color: '#FFB6C1',
        },
      ],
    },
    {
      title: 'Build Tools',
      packages: [
        {
          packages: ['webpack'],
          color: '#8DD6F9',
        },
        {
          packages: ['vite'],
          color: '#008000', // Green color
        },
        {
          packages: ['rollup'],
          color: '#e80A3F',
        },
        {
          packages: ['rolldown'],
          color: '#FF5733',
        },
        {
          packages: ['esbuild'],
          color: '#FFCF00',
        },
        {
          packages: ['@swc/core'],
          color: '#DEAD0F',
        },
        {
          packages: ['parcel'],
          color: '#2D8CFF',
        },
        {
          packages: ['@rspack/core'],
          color: '#8DD6F9',
        },
      ],
    },
    {
      title: 'Testing Frameworks',
      packages: [
        {
          packages: ['jest'],
          color: '#C21325',
        },
        {
          packages: ['vitest'],
          color: '#646CFF',
        },
        {
          packages: ['@testing-library/react'],
          color: '#E33332',
        },
        {
          packages: ['cypress'],
          color: '#4A5568',
        },
        {
          packages: ['playwright'],
          color: '#2EAD33',
        },
        {
          packages: ['@storybook/react'],
          color: '#FF4785',
        },
      ],
    },
    {
      title: 'Form Libraries',
      packages: [
        {
          packages: ['react-hook-form'],
          color: '#EC5990',
        },
        {
          packages: ['@tanstack/form-core'],
          color: '#FFD700',
        },
        {
          packages: ['@conform-to/dom'],
          color: '#FF5733',
        },
      ],
    },
    {
      title: 'UI Component Libraries',
      packages: [
        {
          packages: ['@mui/material'],
          color: '#0081CB',
        },
        {
          packages: ['@chakra-ui/react'],
          color: '#319795',
        },
        {
          packages: ['@radix-ui/themes'],
          color: '#FF6F61',
        },
        {
          packages: ['@headlessui/react'],
          color: '#f43f5e',
        },
        {
          packages: ['@mantine/core'],
          color: '#FFD700',
        },
      ],
    },
    {
      title: 'Animation Libraries',
      packages: [
        {
          packages: ['motion', 'framer-motion'],
          color: '#FF0055',
        },
        {
          packages: ['react-spring'],
          color: '#FF7F50',
        },
        {
          packages: ['@react-spring/web'],
          color: '#FF4500',
        },
        {
          packages: ['gsap'],
          color: '#32CD32',
        },
        {
          packages: ['@motionone/dom'],
          color: '#FF1493',
        },
        {
          packages: ['auto-animate'],
          color: '#FFD700',
        },
      ],
    },
    {
      title: 'Date Libraries',
      packages: [
        {
          packages: ['date-fns'],
          color: '#E91E63',
        },
        {
          packages: ['dayjs'],
          color: '#FF6B6B',
        },
        {
          packages: ['luxon'],
          color: '#3498DB',
        },
        {
          packages: ['moment'],
          color: '#4A5568',
        },
        {
          packages: ['@date-io/date-fns'],
          color: '#FFD700',
        },
        {
          packages: ['temporal-polyfill'],
          color: '#a855f7',
        },
      ],
    },
    {
      title: 'Type Checking',
      packages: [
        {
          packages: ['zod'],
          color: '#ef4444',
        },
        {
          packages: ['io-ts'],
          color: '#3b82f6',
        },
        {
          packages: ['arktype'],
          color: '#10b981',
        },
        {
          packages: ['valibot'],
          color: '#f97316',
        },
        {
          packages: ['yup'],
          color: '#06b6d4',
        },
        {
          packages: ['@sinclair/typebox'],
          color: '#d946ef',
        },
      ],
    },
    {
      title: 'Routing',
      packages: [
        {
          packages: ['react-router'],
          color: '#FF0000',
        },
        {
          packages: ['@tanstack/react-router'],
          color: '#32CD32',
        },
        {
          packages: ['next'],
          color: '#4682B4',
        },
        {
          packages: ['wouter'],
          color: '#8b5cf6',
        },
        {
          packages: ['expo'],
          color: '#f59e0b',
        },
      ],
    },
  ]
}
