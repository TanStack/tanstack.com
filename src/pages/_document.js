import React from 'react'
import Document, { Html, Head, Main, NextScript } from 'next/document'
import { setup, tw } from 'twind'
import { asyncVirtualSheet, getStyleTagProperties } from 'twind/server'
import twindConfig from '../twind.config'
import { css } from 'twind/css'

const sheet = asyncVirtualSheet()
setup({ ...twindConfig, sheet })

// const styles = tw`text-blue-900 bg-gray-100 dark:bg-gray-900 dark:text-gray-100;`

// console.log(styles)

export default class MyDocument extends Document {
  static async getInitialProps(ctx) {
    sheet.reset()

    const initialProps = await Document.getInitialProps(ctx)

    const { id, textContent } = getStyleTagProperties(sheet)

    const styleProps = {
      id,
      key: id,
      dangerouslySetInnerHTML: {
        __html: textContent,
      },
    }

    return {
      ...initialProps,
      styles: [
        ...initialProps.styles,
        React.createElement('style', styleProps),
      ],
    }
  }

  render() {
    return (
      <Html>
        <Head>
          {/* <!-- Global site tag (gtag.js) - Google Analytics --> */}
          <script
            async
            src="https://www.googletagmanager.com/gtag/js?id=G-JMT1Z50SPS"
          ></script>
          <script
            dangerouslySetInnerHTML={{
              __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-JMT1Z50SPS');
          `,
            }}
          ></script>
        </Head>
        <body className={''}>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}
