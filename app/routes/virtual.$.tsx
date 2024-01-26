import { redirect } from '@remix-run/node'

export const loader = () => {
  return redirect('/virtual/latest')
}
