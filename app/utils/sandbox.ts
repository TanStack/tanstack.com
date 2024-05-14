import { type Framework } from '~/libraries'

export const getInitialSandboxFileName = (framework: Framework) =>
  framework === 'svelte'
    ? 'src/App.svelte'
    : framework === 'vue'
    ? 'src/App.vue'
    : framework === 'solid'
    ? 'src/App.tsx'
    : framework === 'angular'
    ? 'src/app/app.component.ts'
    : 'src/main.tsx'
