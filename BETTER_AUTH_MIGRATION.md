# Better Auth Migration Guide

This guide covers the migration from Clerk to Better Auth with GitHub and Google OAuth.

## ✅ Completed Migration Steps

1. **Removed Clerk Dependencies**: Uninstalled `@clerk/tanstack-react-start`
2. **Installed Better Auth**: Added `better-auth` and `@convex-dev/better-auth`
3. **Created Auth Components**: Replaced all Clerk components with Better Auth equivalents
4. **Updated Server Functions**: Migrated authentication server functions
5. **Environment Variables**: Updated schema to support Better Auth credentials
6. **Official Convex Integration**: Implemented using the official `@convex-dev/better-auth` package

## 🔧 Remaining Setup Steps

### 1. Set up OAuth Applications

#### GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: TanStack.com
   - **Homepage URL**: `https://tanstack.com`
   - **Authorization callback URL**: `https://tanstack.com/api/auth/callback/github`
   - For development: `http://localhost:3000/api/auth/callback/github`
4. Save the Client ID and Client Secret

#### Google OAuth App

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/dashboard)
2. Create a new project or select existing
3. Enable the "Google+ API"
4. Go to "Credentials" > "Create Credentials" > "OAuth 2.0 Client IDs"
5. Configure:
   - **Application type**: Web application
   - **Authorized redirect URIs**:
     - `https://tanstack.com/api/auth/callback/google`
     - `http://localhost:3000/api/auth/callback/google` (for development)
6. Save the Client ID and Client Secret

### 2. Environment Variables

Add to your `.env` file:

```bash
# Better Auth
BETTER_AUTH_SECRET=e2Vj8Wxf5f/hMrnnx+wHYmH7aX2AfBvWm+SRw9KPh1M=

# GitHub OAuth (✅ CONFIGURED)
GITHUB_CLIENT_ID=Ov23lieuioArnBbu0pE6
GITHUB_CLIENT_SECRET=2ba264282f56c733d082cd3ed03dd17ae2af78c5

# Google OAuth (✅ CONFIGURED)
GOOGLE_CLIENT_ID=1088273636734-6ov6e1gsr47krsutfogmaug52npp04eb.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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

# Convex (using existing setup)
CONVEX_URL=https://befitting-badger-629.convex.cloud
```

### 3. Database Setup (✅ COMPLETED)

**Using official Convex + Better Auth integration:**

- ✅ Installed `@convex-dev/better-auth` official package
- ✅ Updated Convex configuration with Better Auth component
- ✅ Created proper auth schema following official pattern
- ✅ Implemented Better Auth functions with Convex adapter
- ✅ Integrated with existing Convex setup

The Better Auth tables will be automatically created by the component. The auth data is stored in Convex alongside your application data, with proper type safety and official support.

### 5. Deploy to Netlify

Update your Netlify environment variables:

1. Go to your Netlify site settings
2. Add all the environment variables from step 2
3. Remove the old `VITE_CLERK_PUBLISHABLE_KEY`
4. Deploy

## 🧪 Testing

1. **Local Development**:

   ```bash
   pnpm dev
   ```

   - Test sign-in with GitHub/Google at `/login`
   - Check account page functionality at `/account`

2. **Verify Authentication**:
   - Sign in/out flows work
   - User settings (ads preference) persist
   - Protected routes redirect properly

## 📝 Key Changes Made

### Components Replaced:

- `ClerkProvider` → `AuthProvider`
- `SignedIn`/`SignedOut` → Custom equivalents using `useAuth()`
- `UserButton` → Custom dropdown with user info
- `UserProfile` → Custom profile component
- `Waitlist`/`SignIn` → `SignInButtons` with GitHub/Google

### Server Functions Updated:

- `getCurrentUser()` → Uses Better Auth session
- `checkUserAccess()` → Simplified auth check
- `requireAuth()` → Redirects to `/login`

### Files Modified:

- `src/routes/__root.tsx` - Auth provider integration
- `src/routes/_libraries/route.tsx` - Navigation auth components
- `src/routes/_libraries/login.tsx` - Sign-in page
- `src/routes/_libraries/account.$.tsx` - Account management
- `src/stores/userSettings.ts` - Auth hook integration
- `src/server/auth.ts` - Server-side auth functions
- `src/routes/api/auth.$.ts` - API route handler
- `src/lib/auth.ts` - Better Auth configuration
- `src/lib/auth-client.ts` - Client-side auth
- `src/lib/auth-server-utils.ts` - Server utilities
- `convex/auth.ts` - Convex auth functions
- `convex/schema.ts` - Database schema
- `convex/convex.config.ts` - Convex configuration

## 🚀 Next Steps

1. Set up OAuth apps (GitHub & Google)
2. Configure environment variables
3. Test locally
4. Deploy to Netlify
5. Re-invite your 10 users via the new sign-in flow

The migration removes the waitlist functionality - users can now sign in directly with GitHub or Google.
