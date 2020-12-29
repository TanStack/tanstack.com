import React from 'react';
import Document, { Html, Head, Main, NextScript } from 'next/document';
import { asyncVirtualSheet, getStyleTagProperties } from 'twind/server';

import { setup } from 'twind';
import twindConfig from '../twind.config';

const sheet = asyncVirtualSheet();
setup({ ...twindConfig, sheet });
export default class MyDocument extends Document {
  static async getInitialProps(ctx) {
    sheet.reset();
    const initialProps = await Document.getInitialProps(ctx);
    const { id, textContent } = getStyleTagProperties(sheet);
    const styleProps = {
      id,
      key: id,
      dangerouslySetInnerHTML: {
        __html: textContent,
      },
    };
    return {
      ...initialProps,
      styles: [
        ...initialProps.styles,
        React.createElement('style', styleProps),
      ],
    };
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
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
