import { LoaderFunction } from 'remix'

export const loader: LoaderFunction = async (context) => {
  const res = await fetch(
    `https://cdn.carbonads.com/carbon.js?serve=CE7DEKQI&placement=react-tannerlinsleycom`
  )

  if (!res.ok) {
    throw new Error(`Failed to load Carbon ads: ${res.status}`)
  }

  return new Response(await res.text(), {
    headers: {
      'content-type': 'text/javascript',
    },
  })
}
