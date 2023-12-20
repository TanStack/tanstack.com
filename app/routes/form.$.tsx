import { redirect } from '@remix-run/node'

export const loader = () => {
  return redirect(`/form/latest`, 301)
}
