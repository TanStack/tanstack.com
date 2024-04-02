import { useState } from 'react'

function sendBytesOptIn({
  email,
  influencer,
  source,
  referral,
}: {
  email: string
  influencer: string
  source?: string
  referral?: string
}) {
  return fetch(`https://bytes.dev/api/bytes-optin-cors`, {
    method: 'POST',
    body: JSON.stringify({ email, influencer, source, referral }),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  }).then((res) => res.json())
}

export default function useBytesSubmit() {
  const [state, setState] = useState('initial')
  const [error, setError] = useState(null)

  const handleSubmit = (e: any) => {
    e.preventDefault()
    const email = e.target.email_address.value
    setState('loading')
    sendBytesOptIn({ email, influencer: 'tanstack' })
      .then(() => {
        setState('submitted')
      })
      .catch((err) => {
        setError(err)
      })
  }

  return { handleSubmit, state, error }
}
