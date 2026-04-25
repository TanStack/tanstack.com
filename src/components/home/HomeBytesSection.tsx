import { Card } from '~/components/Card'
import { Footer } from '~/components/Footer'
import { useToast } from '~/components/ToastProvider'
import { useMutation } from '~/hooks/useMutation'
import bytesImage from '~/images/bytes.svg'
import { Button } from '~/ui'

async function bytesSignupServerFn({ email }: { email: string }) {
  'use server'

  return fetch(`https://bytes.dev/api/bytes-optin-cors`, {
    method: 'POST',
    body: JSON.stringify({
      email,
      influencer: 'tanstack',
    }),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })
}

export function HomeBytesSection() {
  const bytesSignupMutation = useMutation({
    fn: bytesSignupServerFn,
  })
  const { notify } = useToast()

  return (
    <>
      <div className="px-4 mx-auto max-w-(--breakpoint-lg) relative">
        <Card className="rounded-md p-8 md:p-14">
          {!bytesSignupMutation.submittedAt ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                const email = formData.get('email_address')?.toString() || ''

                const result = await bytesSignupMutation.mutate({ email })
                if (result?.ok) {
                  notify(
                    <div>
                      <div className="font-medium">Thanks for subscribing</div>
                      <div className="text-gray-500 dark:text-gray-400 text-xs">
                        Check your email to confirm your subscription
                      </div>
                    </div>,
                  )
                } else if (bytesSignupMutation.status === 'error') {
                  notify(
                    <div>
                      <div className="font-medium">Subscription failed</div>
                      <div className="text-gray-500 dark:text-gray-400 text-xs">
                        Please try again in a moment
                      </div>
                    </div>,
                  )
                }
              }}
            >
              <div>
                <div className="relative inline-block">
                  <h3 id="bytes" className="text-3xl font-bold scroll-mt-24">
                    <a
                      href="#bytes"
                      className="hover:underline decoration-gray-400 dark:decoration-gray-600"
                    >
                      Subscribe to Bytes
                    </a>
                  </h3>
                  <figure className="absolute top-0 right-[-48px]">
                    <img
                      src={bytesImage}
                      alt="Bytes Logo"
                      loading="lazy"
                      width={40}
                      height={40}
                    />
                  </figure>
                </div>

                <h3 className="text-lg mt-1">The Best JavaScript Newsletter</h3>
              </div>
              <div className="grid grid-cols-3 mt-4 gap-2">
                <input
                  disabled={bytesSignupMutation.status === 'pending'}
                  className="col-span-2 p-3 placeholder-gray-400 text-black bg-gray-200 rounded text-sm outline-none focus:outline-none w-full dark:(text-white bg-gray-700)"
                  name="email_address"
                  placeholder="Your email address"
                  type="text"
                  required
                />
                <Button
                  type="submit"
                  className="bg-[#ED203D] border-[#ED203D] hover:bg-[#d41c35] text-white justify-center"
                >
                  {bytesSignupMutation.status === 'pending'
                    ? 'Loading ...'
                    : 'Subscribe'}
                </Button>
              </div>
              {bytesSignupMutation.error ? (
                <p className="text-sm text-red-500 font-semibold italic mt-2">
                  Looks like something went wrong. Please try again.
                </p>
              ) : (
                <p className="text-sm opacity-30 font-semibold italic mt-2">
                  Join over 100,000 devs
                </p>
              )}
            </form>
          ) : (
            <p>🎉 Thank you! Please confirm your email</p>
          )}
        </Card>
      </div>
      <div className="h-20" />
      <Footer />
    </>
  )
}
