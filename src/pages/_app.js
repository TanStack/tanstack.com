import React from 'react'
import Head from 'next/head'
import { GlobalStyles } from 'twin.macro'
import '../styles.css'

// function loadScript(src, attrs = {}) {
//   if (typeof document !== 'undefined') {
//     const script = document.createElement('script')
//     script.async = true
//     script.defer = true
//     Object.keys(attrs).forEach((attr) => script.setAttribute(attr, attrs[attr]))
//     script.src = src
//     document.body.appendChild(script)
//   }
// }

function MyApp({ Component, pageProps }) {
  // React.useEffect(() => {
  //   loadScript('https://tanstack.ck.page/7b33d93773/index.js', {
  //     'data-uid': '7b33d93773',
  //   })
  // }, [])

  return (
    <>
      <GlobalStyles />
      <Component {...pageProps} />
    </>
  )
}

export default MyApp
