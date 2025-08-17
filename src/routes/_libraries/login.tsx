import { Authenticated, Unauthenticated, useMutation } from 'convex/react'
import * as React from 'react'
import { useState } from 'react'
import { PiEnvelopeBold, PiHandWavingLight } from 'react-icons/pi'
import { authClient } from '~/libraries/auth-client'
import { api } from '../../../convex/_generated/api'
import { useIsDark } from '~/hooks/useIsDark'
import { FaArrowRight } from 'react-icons/fa'

export const Route = createFileRoute({
  component: LoginPage,
})

function SplashImage() {
  const isDark = useIsDark()
  return (
    <div className="flex items-center justify-center mb-4">
      <img
        src={
          isDark
            ? '/src/images/splash-dark.png'
            : '/src/images/splash-light.png'
        }
        alt="Waitlist"
        className="w-48 h-48"
      />
    </div>
  )
}

function WaitlistSubmitted({
  waitlistEmail,
  onBackToSignIn,
}: {
  waitlistEmail: string
  onBackToSignIn: () => void
}) {
  return (
    <div className="bg-white dark:bg-black/30 rounded-lg shadow-lg p-8 max-w-sm w-[100vw] mx-auto">
      <SplashImage />
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
        You're on the waitlist!
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 text-center max-w-xs">
        We'll notify you at <strong>{waitlistEmail}</strong>
        <br /> as soon as you're approved.
      </p>
      <button
        onClick={onBackToSignIn}
        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium text-sm"
      >
        Back to Sign In
      </button>
    </div>
  )
}

function SignInForm({ 
    onBackToWaitlist 
  }: { 
    onBackToWaitlist: () => void 
  }) {
  const [errorMessage, setErrorMessage] = useState('')
  const [signingIn, setSigningIn] = useState(false)
  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.target as HTMLFormElement)

    try {
      setErrorMessage('')
      setSigningIn(true)
      await authClient.signIn.email(
        {
          email: formData.get('email') as string,
          password: formData.get('password') as string,
        },
        {
          onError: (ctx) => {
            setErrorMessage(`Error: ${ctx.error.message}`)
            setSigningIn(false)
          },
        }
      )
    } catch (error) {
      console.error('Sign in error:', error)
    }
  }

  return (
    <div className="bg-white dark:bg-black/30 rounded-lg shadow-lg p-8 w-[100vw] max-w-sm mx-auto">
      <SplashImage />
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 text-center">
        Sign into your TanStack Account
      </h2>
      <form onSubmit={handleSignIn} className="space-y-4">
        <div>
          <input
            type="email"
            name="email"
            placeholder="Email"
            required
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div>
          <input
            type="password"
            name="password"
            placeholder="Password"
            required
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>

        <button
          type="submit"
          disabled={signingIn}
          className="w-full bg-black/80 hover:bg-black text-white dark:text-black dark:bg-white/95 dark:hover:bg-white font-semibold py-2 px-4 rounded-md transition-colors"
        >
          {signingIn ? 'Signing in...' : 'Sign in'}
        </button>
        {errorMessage && (
          <p className="text-red-500 mt-1 w-full text-left">{errorMessage}</p>
        )}
      </form>

      <div className="mt-6 text-right">
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Don't have access?{' '}
          <button
            onClick={onBackToWaitlist}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
          >
            Join the waitlist
          </button>
        </p>
      </div>
    </div>
  )
}

function WaitlistForm({ onShowSignIn }: { onShowSignIn: () => void }) {
  const [errorMessage, setErrorMessage] = useState('')
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const joinWaitlist = useMutation(api.waitlist.joinWaitlist)

  const handleWaitlistSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      await joinWaitlist({ email: waitlistEmail })
      setWaitlistSubmitted(true)
    } catch (error) {
      console.error('Failed to join waitlist:', error)
      setErrorMessage('Failed to join waitlist. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (waitlistSubmitted) {
    return (
      <WaitlistSubmitted
        waitlistEmail={waitlistEmail}
        onBackToSignIn={onShowSignIn}
      />
    )
  }

  return (
    <div className="bg-white dark:bg-black/30 rounded-lg shadow-lg p-8 max-w-sm w-[100vw] mx-auto">
      <SplashImage />
      <h2 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-1">
        Join the waitlist
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 text-center max-w-xs">
        Enter your email and we'll let you know when your spot is ready.
      </p>
      <form onSubmit={handleWaitlistSubmit} className="space-y-4">
        <div>
          <input
            type="email"
            value={waitlistEmail}
            onChange={(e) => setWaitlistEmail(e.target.value)}
            placeholder="Email"
            required
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full dark:bg-white/95 bg-black hover:bg-black/80 dark:hover:bg-white text-white dark:text-black/80 font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex flex-row items-center justify-center text-sm"
        >
          {isSubmitting ? 'Submitting...' : 'Request Access'}
          <PiEnvelopeBold className="ml-2" />
        </button>
        {errorMessage && (
          <p className="text-red-500 mt-1 w-full text-left">{errorMessage}</p>
        )}
      </form>

      <div className="mt-6 text-right">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Already have access?{' '}
          <button
            onClick={() => {
              setErrorMessage('')
              onShowSignIn()
            }}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
          >
            Sign In
          </button>
        </p>
      </div>
    </div>
  )
}
function Welcome() {
  const [waved, setWaved] = React.useState(false)
  React.useEffect(() => {
    // Trigger wave on mount once
    setWaved(true)
  }, [])

  return (
    <>
      <style>{`
        @keyframes hand-wave {
          0% { transform: rotate(0deg); }
          20% { transform: rotate(12deg); }
          50% { transform: rotate(-8deg); }
          80% { transform: rotate(6deg); }
          100% { transform: rotate(0deg); }
        }
      `}</style>
      <div className="bg-white dark:bg-black/30 rounded-lg shadow-lg p-8 w-[100vw] mx-auto max-w-sm">
        <div className="flex text-2xl items-center justify-center w-48 h-48 mx-auto">
          <div
            style={{
              transformOrigin: '80% 90%',
              animation: waved ? 'hand-wave 1s ease-in-out 1' : undefined,
            }}
          >
            <PiHandWavingLight className="w-24 h-24 text-yellow-500 rounded-full" />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1 text-center">
          Welcome!
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 text-center">
          You've been approved from the waitlist and have full access to
          TanStack.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mt-16">
          <a
            href="/account"
            className="inline-block bg-black/80 hover:bg-black text-white dark:text-black dark:bg-white/90 dark:hover:bg-white font-semibold py-2 px-6 rounded-md transition-colors text-center"
          >
            Account Settings
            <FaArrowRight className="inline-block ml-2" />
          </a>
        </div>
      </div>
    </>
  )
}

function LoginPage() {
  const [activeView, setActiveView] = useState<'login' | 'waitlist'>('waitlist')

  let view = null
  if (activeView === 'login') {
    view = <SignInForm onBackToWaitlist={() => setActiveView('waitlist')} />
  } else if (activeView === 'waitlist') {
    view = <WaitlistForm onShowSignIn={() => setActiveView('login')} />
  }

  return (
    <div className="min-h-screen ">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center w-fit">
          <Unauthenticated>
            {view}
          </Unauthenticated>
          <Authenticated>
            <Welcome />
          </Authenticated>
        </div>
      </div>
    </div>
  )
}
