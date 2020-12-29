import React from 'react';
import { Seo } from '../components/Seo';

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <Seo
        title="Quality Software & Open Source Libraries for the Modern Web"
        description={`TanStack is an incubator and collection of software, products, tools and courses for building professional and enterprise-grade front-end applciations for the web.`}
      />
      <Component {...pageProps} />
    </>
  );
}
