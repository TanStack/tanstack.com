import React from 'react'
import { FaGithub, FaGoogle } from 'react-icons/fa'
import { authClient } from '~/lib/auth-client'

interface SignInButtonProps {
  provider: 'github' | 'google'
  children?: React.ReactNode
  className?: string
}

export function SignInButton({
  provider,
  children,
  className = 'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors',
}: SignInButtonProps) {
  const handleSignIn = async () => {
    await authClient.signIn.social({
      provider,
    })
  }

  const providerConfig = {
    github: {
      icon: <FaGithub />,
      label: 'Continue with GitHub',
      className: 'bg-gray-900 hover:bg-gray-800 text-white',
    },
    google: {
      icon: <FaGoogle />,
      label: 'Continue with Google',
      className: 'bg-blue-600 hover:bg-blue-700 text-white',
    },
  }

  const config = providerConfig[provider]

  return (
    <button
      onClick={handleSignIn}
      className={`${className} ${config.className}`}
    >
      {config.icon}
      {children || config.label}
    </button>
  )
}

// Combined sign-in component for both providers
export function SignInButtons({ className }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <SignInButton provider="github" />
      <SignInButton provider="google" />
    </div>
  )
}
