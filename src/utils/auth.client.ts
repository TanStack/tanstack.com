// Minimal auth client for OAuth flows
export const authClient = {
  signIn: {
    social: ({ provider }: { provider: 'github' | 'google' }) => {
      window.location.href = `/auth/${provider}/start`
    },
  },
  signOut: async () => {
    window.location.href = '/auth/signout'
  },
}
