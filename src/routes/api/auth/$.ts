import { createFileRoute } from '@tanstack/react-router'
//import { reactStartHandler } from '@convex-dev/better-auth/react-start'

export const reactStartHandler = (
  request: Request,
  opts?: { convexSiteUrl?: string; verbose?: boolean }
) => {
  const requestUrl = new URL(request.url);
  const convexSiteUrl = opts?.convexSiteUrl ?? process.env.VITE_CONVEX_SITE_URL;
  if (!convexSiteUrl) {
    throw new Error("VITE_CONVEX_SITE_URL is not set");
  }
  const nextUrl = `${convexSiteUrl}${requestUrl.pathname}${requestUrl.search}`;
  const headers = new Headers(request.headers);
  headers.set("accept-encoding", "application/json");
  return fetch(nextUrl, {
    method: request.method,
    headers,
    redirect: "manual",
    body: request.body,
    // @ts-expect-error - duplex is required for streaming request bodies in modern fetch
    duplex: "half",
  });
};


export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => {
        return reactStartHandler(request)
      },
      POST: ({ request }) => {
        return reactStartHandler(request)
      },
    },
  },
})