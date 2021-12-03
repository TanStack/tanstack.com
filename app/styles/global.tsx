import { theme } from 'twind'
import { css, apply } from 'twind/css'

export const getGlobalStyles = () => css`
  html,
  body {
    ${apply`text-blue-900 bg-gray-100 dark:bg-gray-900 dark:text-gray-100`}
  }

  @media (prefers-color-scheme: dark) {
    * {
      scrollbar-color: ${theme('colors.gray.700')} ${theme('colors.gray.800')};

      ::-webkit-scrollbar,
      scrollbar {
        width: 1rem;
        height: 1rem;
      }

      ::-webkit-scrollbar-track,
      scrollbar-track {
        background: ${theme('colors.gray.800')};
      }

      ::-webkit-scrollbar-thumb,
      scrollbar-thumb {
        background: ${theme('colors.gray.700')};
        border-radius: 0.5rem;
        border: 3px solid ${theme('colors.gray.800')};
      }
    }
  }

  [disabled] {
    ${apply`opacity-50 pointer-events-none`}
  }
`
