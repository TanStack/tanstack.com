import React from 'react'
import Head from 'next/head'
import { GlobalStyles, theme } from 'twin.macro'
import { createGlobalStyle } from 'styled-components'
import '../styles.css'
import { Seo } from '../components/Seo'

const MyGlobalStyles = createGlobalStyle`
  @media (prefers-color-scheme: dark) {
    * {
      scrollbar-color: ${theme`colors.gray.700`} ${theme`colors.gray.800`};

      ::-webkit-scrollbar, scrollbar {
        width: 1rem;
        height: 1rem;
      }

      ::-webkit-scrollbar-track, scrollbar-track {
        background: ${theme`colors.gray.800`};
      }

      ::-webkit-scrollbar-thumb, scrollbar-thumb {
        background: ${theme`colors.gray.700`};
        border-radius: .5rem;
        border: 3px solid ${theme`colors.gray.800`};
      }
    }
  }
`

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <Seo
        title="Quality Software & Open Source Libraries for the Modern Web"
        description={`TanStack is an incubator and collection of software, products, tools and courses for building professional and enterprise-grade front-end applciations for the web.`}
      />
      <GlobalStyles />
      <MyGlobalStyles />
      <Component {...pageProps} />
    </>
  )
}
