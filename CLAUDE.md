# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TanStack.com is the official website and documentation hub for all TanStack open-source libraries (React Query, React Table, React Router, React Form, etc.). Built with TanStack Router/Start as a full-stack React application.

## Essential Commands

```bash
# Development
pnpm dev              # Run frontend (Vite) + backend (Convex) in parallel
pnpm dev:frontend     # Frontend only (Vite dev server)
pnpm dev:backend      # Backend only (Convex)

# Build & Deploy
pnpm build            # Production build
pnpm start            # Production start

# Code Quality
pnpm lint             # Run Prettier + ESLint checks
pnpm format           # Auto-format with Prettier

# Local Package Development
pnpm linkAll          # Link local TanStack packages (requires sibling repos)
```

## Architecture Overview

### Tech Stack
- **Framework**: TanStack Router + TanStack Start (file-system based routing)
- **Styling**: Tailwind CSS with custom design tokens
- **Backend**: Convex (real-time backend service)
- **Auth**: Clerk
- **Content**: Content Collections + Markdown for docs/blog
- **Build**: Vite

### Key Directory Structure
- `src/routes/` - File-system based routing (TanStack Router)
- `src/components/` - Shared React components
- `src/libraries/` - Library configurations and metadata
- `src/blog/` - Blog posts in Markdown
- `convex/` - Backend functions (Convex)
- `scripts/` - Build and development scripts

### Routing System
Uses TanStack Router's file-system routing. Key patterns:
- `src/routes/__root.tsx` - Root layout
- `src/routes/[framework]/[library]/*.tsx` - Dynamic library docs
- Route files export `createFileRoute()` for route configuration
- Layouts use `_layout.tsx` convention

### Content System
Documentation is fetched from GitHub in production or read locally in development:
- Library docs pulled from respective GitHub repos
- Blog posts stored locally in `src/blog/`
- Content processed via Content Collections
- Supports multiple framework variations (React, Vue, Angular, Solid)

### State Management
- **TanStack Query**: Server state and data fetching
- **Zustand**: Client state (`src/stores/`)
- **React Context**: Theme and auth providers

### Backend (Convex)
- Functions in `convex/` directory
- Real-time subscriptions and mutations
- Handles user data, sponsors, authentication

## Development Setup Requirements

1. **Environment Variables**: Create `.env` file with:
   - Clerk tokens (auth)
   - Convex deployment URL
   - Sentry DSN (optional)

2. **Local Package Development**: 
   - Parent directory must be named `tanstack/`
   - Sibling repos required for local docs: `tanstack/query`, `tanstack/router`, etc.
   - Run `pnpm linkAll` to link local packages

3. **Port Configuration**: Dev server runs on port 3000

## Important Patterns

### Component Creation
- Use TypeScript with explicit types
- Follow existing component patterns in `src/components/`
- Tailwind classes for styling (avoid inline styles)

### Route Creation
```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/path')({
  component: RouteComponent,
})

function RouteComponent() {
  // Component implementation
}
```

### API/Backend Calls
Use Convex hooks:
```tsx
import { useQuery, useMutation } from 'convex/react'
import { api } from '~/convex/_generated/api'

const data = useQuery(api.functions.myFunction)
const mutate = useMutation(api.functions.myMutation)
```

### Content/Documentation Updates
- Blog posts: Add Markdown files to `src/blog/`
- Library metadata: Update `src/libraries/[library].tsx`
- Documentation pulled from respective library repos (not edited here)
