import { redirect } from '@remix-run/node'

export const loader = async () => {
  return redirect(`https://cottonbureau.com/people/tanstack`, 301)
}
