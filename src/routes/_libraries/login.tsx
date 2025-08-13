import { authClient } from '~/libraries/auth-client'
import { useIsDark } from '~/hooks/useIsDark'
import { FaGithub, FaGoogle } from 'react-icons/fa'

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

function SignInForm() {
  return (
    <div className="bg-white dark:bg-black/30 rounded-lg shadow-lg p-8 w-[100vw] max-w-sm mx-auto">
      <SplashImage />
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 text-center">
        Sign into your TanStack Account
      </h2>
      <button
        onClick={() => authClient.signIn.social({ 
          provider: 'github',
          callbackURL: '/dashboard',
        })}
        className="w-full bg-black/80 hover:bg-black text-white dark:text-black dark:bg-white/95 dark:hover:bg-white font-semibold py-2 px-4 rounded-md transition-colors"
      >
        <FaGithub className="inline-block mr-2" /> Sign in with GitHub
      </button>
      <button
        onClick={() => authClient.signIn.social({ 
          provider: 'google',
          callbackURL: '/dashboard',
        })}
        className="w-full bg-[#DB4437]/95 hover:bg-[#DB4437] text-white font-semibold py-2 px-4 rounded-md transition-colors mt-4"
        >
        <FaGoogle className="inline-block mr-2" /> Sign in with Google
      </button>
    </div>
  )
}

function LoginPage() {
  return (
    <div className="min-h-screen ">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center w-fit">
          <SignInForm />
        </div>
      </div>
    </div>
  )
}
