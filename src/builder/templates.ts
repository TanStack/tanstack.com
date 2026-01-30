/**
 * Template Presets
 *
 * Hardcoded preset configurations for common app types.
 * Users can select a template to pre-populate features, then modify freely.
 */

import type { LucideIcon } from 'lucide-react'
import {
  Rocket,
  Bot,
  LayoutDashboard,
  FileText,
  Server,
  Radio,
  Globe,
  HardDrive,
  Plus,
} from 'lucide-react'

export interface Template {
  id: string
  name: string
  description: string
  icon: LucideIcon
  color: string
  features: Array<string>
}

export const TEMPLATES: Array<Template> = [
  {
    id: 'blank',
    name: 'Blank',
    description: 'Start from scratch',
    icon: Plus,
    color: '#6B7280', // gray
    features: ['cloudflare'],
  },
  {
    id: 'saas',
    name: 'SaaS Starter',
    description: 'Auth, database, monitoring',
    icon: Rocket,
    color: '#F97316', // orange
    features: [
      'cloudflare',
      'clerk',
      'neon',
      'sentry',
      'shadcn',
      'tanstack-form',
    ],
  },
  {
    id: 'ai-chat',
    name: 'AI Chat',
    description: 'LLM-powered app',
    icon: Bot,
    color: '#8B5CF6', // violet
    features: ['cloudflare', 'ai', 'tanstack-store', 'shadcn'],
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Admin panels, data tables',
    icon: LayoutDashboard,
    color: '#3B82F6', // blue
    features: [
      'cloudflare',
      'tanstack-table',
      'tanstack-query',
      'shadcn',
      'tanstack-form',
    ],
  },
  {
    id: 'blog',
    name: 'Blog / CMS',
    description: 'Content-driven site',
    icon: FileText,
    color: '#EC4899', // pink
    features: ['cloudflare', 'strapi', 'tanstack-query'],
  },
  {
    id: 'api-first',
    name: 'API-First',
    description: 'Type-safe backend APIs',
    icon: Server,
    color: '#10B981', // emerald
    features: ['cloudflare', 'trpc', 'tanstack-query', 'drizzle'],
  },
  {
    id: 'realtime',
    name: 'Realtime',
    description: 'Live, collaborative features',
    icon: Radio,
    color: '#EF4444', // red
    features: ['cloudflare', 'convex', 'tanstack-query'],
  },
  {
    id: 'i18n',
    name: 'Multi-Language',
    description: 'Internationalized app',
    icon: Globe,
    color: '#06B6D4', // cyan
    features: ['cloudflare', 'paraglide', 'shadcn'],
  },
  {
    id: 'local-first',
    name: 'Local-First',
    description: 'Offline-capable, sync-enabled',
    icon: HardDrive,
    color: '#F59E0B', // amber
    features: ['cloudflare', 'tanstack-db', 'tanstack-query', 'tanstack-store'],
  },
]
