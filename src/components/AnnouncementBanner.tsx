import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation, Link } from '@tanstack/react-router'
import {
  X,
  Info,
  AlertTriangle,
  CheckCircle,
  Gift,
  ExternalLink,
  ArrowRight,
} from 'lucide-react'
import {
  getActiveBanners,
  getDismissedBannerIds,
  dismissBanner,
  type ActiveBanner,
} from '~/utils/banner.functions'

const DISMISSED_BANNERS_KEY = 'tanstack_dismissed_banners'

// Get dismissed banner IDs from localStorage (for anonymous users)
function getLocalDismissedBanners(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(DISMISSED_BANNERS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

// Save dismissed banner ID to localStorage
function saveLocalDismissedBanner(bannerId: string) {
  if (typeof window === 'undefined') return
  try {
    const existing = getLocalDismissedBanners()
    if (!existing.includes(bannerId)) {
      localStorage.setItem(
        DISMISSED_BANNERS_KEY,
        JSON.stringify([...existing, bannerId]),
      )
    }
  } catch {
    // Ignore localStorage errors
  }
}

const BANNER_STYLES = {
  info: {
    icon: Info,
    bgClass:
      'bg-blue-100/90 dark:bg-blue-950/90 backdrop-blur-md border-blue-200 dark:border-blue-800',
    textClass: 'text-blue-900 dark:text-blue-100',
    iconClass: 'text-blue-600 dark:text-blue-400',
    linkClass:
      'text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200',
  },
  warning: {
    icon: AlertTriangle,
    bgClass:
      'bg-amber-100/90 dark:bg-amber-950/90 backdrop-blur-md border-amber-200 dark:border-amber-800',
    textClass: 'text-amber-900 dark:text-amber-100',
    iconClass: 'text-amber-600 dark:text-amber-400',
    linkClass:
      'text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200',
  },
  success: {
    icon: CheckCircle,
    bgClass:
      'bg-green-100/90 dark:bg-green-950/90 backdrop-blur-md border-green-200 dark:border-green-800',
    textClass: 'text-green-900 dark:text-green-100',
    iconClass: 'text-green-600 dark:text-green-400',
    linkClass:
      'text-green-700 dark:text-green-300 hover:text-green-800 dark:hover:text-green-200',
  },
  promo: {
    icon: Gift,
    bgClass:
      'bg-purple-100/90 dark:bg-purple-950/90 backdrop-blur-md border-purple-200 dark:border-purple-800',
    textClass: 'text-purple-900 dark:text-purple-100',
    iconClass: 'text-purple-600 dark:text-purple-400',
    linkClass:
      'text-purple-700 dark:text-purple-300 hover:text-purple-800 dark:hover:text-purple-200',
  },
} as const

interface BannerItemProps {
  banner: ActiveBanner
  onDismiss: (bannerId: string) => void
}

function BannerItem({ banner, onDismiss }: BannerItemProps) {
  const style = BANNER_STYLES[banner.style] || BANNER_STYLES.info
  const Icon = style.icon
  const isExternalLink =
    banner.linkUrl?.startsWith('http://') ||
    banner.linkUrl?.startsWith('https://')
  const isInternalLink = banner.linkUrl?.startsWith('/')

  const linkContent = banner.linkUrl && (
    <span className="inline-flex items-center gap-1.5 font-medium underline underline-offset-2 hover:no-underline">
      {banner.linkText || 'Learn More'}
      {isExternalLink ? (
        <ExternalLink className="w-3 h-3" />
      ) : (
        <ArrowRight className="w-3 h-3" />
      )}
    </span>
  )

  return (
    <div
      className={`border-b ${style.bgClass} ${style.textClass}`}
      role="alert"
    >
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-start gap-3">
          <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${style.iconClass}`} />
          <div className="flex-1 min-w-0">
            <div className="font-medium">{banner.title}</div>
            {banner.content && (
              <div className="text-sm opacity-90 mt-0.5 line-clamp-2">
                {banner.content}
              </div>
            )}
            {banner.linkUrl && (
              <div className={`text-sm mt-1.5 ${style.linkClass}`}>
                {isExternalLink ? (
                  <a
                    href={banner.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {linkContent}
                  </a>
                ) : isInternalLink ? (
                  <Link to={banner.linkUrl}>{linkContent}</Link>
                ) : (
                  <a href={banner.linkUrl}>{linkContent}</a>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onDismiss(banner.id)
            }}
            className="flex-shrink-0 p-1 rounded-md opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-all"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function AnnouncementBanner() {
  const location = useLocation()
  const queryClient = useQueryClient()
  const [localDismissed, setLocalDismissed] = React.useState<string[]>([])

  // Load local dismissed banners on mount (client-side only)
  React.useEffect(() => {
    setLocalDismissed(getLocalDismissedBanners())
  }, [])

  // Fetch active banners for current path
  const bannersQuery = useQuery({
    queryKey: ['activeBanners', location.pathname],
    queryFn: () => getActiveBanners({ data: { pathname: location.pathname } }),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  // Fetch dismissed banner IDs for logged-in users
  const dismissedQuery = useQuery({
    queryKey: ['dismissedBanners'],
    queryFn: () => getDismissedBannerIds(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  // Mutation to dismiss a banner
  const dismissMutation = useMutation({
    mutationFn: (bannerId: string) => dismissBanner({ data: { bannerId } }),
    onSuccess: (result, bannerId) => {
      if (result.success) {
        // Server dismissal succeeded (logged-in user)
        queryClient.invalidateQueries({ queryKey: ['dismissedBanners'] })
      }
      // Always save to localStorage as fallback
      saveLocalDismissedBanner(bannerId)
      setLocalDismissed((prev) => [...prev, bannerId])
    },
    onError: (_, bannerId) => {
      // If server fails, still save locally
      saveLocalDismissedBanner(bannerId)
      setLocalDismissed((prev) => [...prev, bannerId])
    },
  })

  const handleDismiss = (bannerId: string) => {
    dismissMutation.mutate(bannerId)
  }

  // Combine server and local dismissed IDs
  const allDismissed = React.useMemo(() => {
    const serverDismissed = dismissedQuery.data || []
    return new Set([...serverDismissed, ...localDismissed])
  }, [dismissedQuery.data, localDismissed])

  // Filter out dismissed banners
  const visibleBanners = React.useMemo(() => {
    if (!bannersQuery.data) return []
    return bannersQuery.data.filter((banner) => !allDismissed.has(banner.id))
  }, [bannersQuery.data, allDismissed])

  if (visibleBanners.length === 0) {
    return null
  }

  return (
    <div className="w-full">
      {visibleBanners.map((banner) => (
        <BannerItem
          key={banner.id}
          banner={banner}
          onDismiss={handleDismiss}
        />
      ))}
    </div>
  )
}
