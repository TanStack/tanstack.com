export const ServerRoute = createServerFileRoute().methods({
  GET: async ({ request }) => {
    return new Response('Foo bar')
  },
})
