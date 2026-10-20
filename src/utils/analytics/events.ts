/**
 * Typed event registry for GA4 analytics.
 *
 * Source of truth for every event the site emits. The discriminated union
 * means wrong/missing props for a given event name produce a TypeScript
 * error at the call site rather than silent bad data downstream.
 *
 * See `.agents/analytics.md` for the human-readable reference (event
 * meanings, funnel definition, custom dimensions, BigQuery setup).
 */

import type { PartnerPlacementOrderStrategy } from '../partner-placement'

// ---------- Enums ----------

export type PartnerPlacement =
  | 'directory'
  | 'detail'
  | 'docs_rail'
  | 'blog_rail'
  | 'grid'
  | 'home_grid'
  | 'library_grid'
  | 'embed_grid'
  | 'docs_strip'
  | 'ecosystem_game'
  | 'partners_index_cta'
  | 'library_callout'
  | 'navbar'

export type PartnerClickDestination =
  | 'external'
  | 'internal_detail'
  | 'internal_resource'

export type PartnerTierValue = 'gold' | 'silver' | 'bronze'

export type PartnerFilterChange = 'status_changed'

export type ApplicationStarterMode = 'lucky' | 'confident' | 'none'

export type ApplicationStarterAction =
  | 'copy_prompt'
  | 'deploy'
  | 'clone_repo'
  | 'open_codex'
  | 'open_claude'
  | 'open_cursor'
  | 'open_prompt_builder'
  | 'download'
  | 'open_advanced'
  | 'netlify_start'
  | 'provider_redirect_manual'
  | 'provider_redirect_auto'
  | 'open_repo'

export type ApplicationStarterSurface = 'result_panel' | 'deploy_dialog'

export type ApplicationStarterFailureStage =
  | 'analysis'
  | 'generation'
  | 'login_blocked'

// ---------- Session context ----------

/**
 * Slow-changing context stamped on every Application Starter event so any breakdown
 * works in GA4 without joining sessions in BigQuery.
 */
export interface ApplicationStarterSessionContext {
  mode_used: ApplicationStarterMode
  idea_used: string
}

// ---------- Event union ----------

export type AnalyticsEvent =
  | {
      name: 'page_view'
      props: {
        page_location: string
        page_path: string
        page_title: string
      }
    }
  | {
      name: 'partner_viewed'
      props: {
        partner_id: string
        order_strategy?: PartnerPlacementOrderStrategy
        placement: PartnerPlacement
        partner_tier?: PartnerTierValue
        rotation_seed?: string
        slot_index?: number
      }
    }
  | {
      name: 'partner_clicked'
      props: {
        partner_id: string
        placement: PartnerPlacement
        destination: PartnerClickDestination
        destination_host?: string
        order_strategy?: PartnerPlacementOrderStrategy
        partner_tier?: PartnerTierValue
        rotation_seed?: string
        slot_index?: number
      }
    }
  | {
      name: 'partner_filter_applied'
      props: {
        change: PartnerFilterChange
        status_filter: string | null
        result_count: number
      }
    }
  | {
      name: 'partner_inquiry_started'
      props: {
        placement: PartnerPlacement
      }
    }
  | {
      name: 'application_starter_analyzed'
      props: ApplicationStarterSessionContext & {
        analysis_deployment?: string
        inferred_library_count: number
        inferred_partner_count: number
        feature_count: number
      }
    }
  | {
      name: 'application_starter_generated'
      props: ApplicationStarterSessionContext & {
        final_deployment?: string
        final_package_manager?: string
        final_library_count: number
        final_partner_count: number
        final_addon_count: number
        library_ids: string
        partner_ids: string
        addon_ids: string
      }
    }
  | {
      name: 'application_starter_failed'
      props: ApplicationStarterSessionContext & {
        stage: ApplicationStarterFailureStage
        error_message?: string
        retry_after?: number
        anonymous_generations_remaining?: number
      }
    }
  | {
      name: 'application_starter_activated'
      props: ApplicationStarterSessionContext & {
        action: ApplicationStarterAction
        surface: ApplicationStarterSurface
        provider?: string
        automatic: boolean
      }
    }

// ---------- Helper types ----------

export type AnalyticsEventName = AnalyticsEvent['name']

export type AnalyticsEventProps<TName extends AnalyticsEventName> = Extract<
  AnalyticsEvent,
  { name: TName }
>['props']

/**
 * Default session context for new Application Starter sessions. `mode_used = 'none'`
 * means the user hasn't picked Lucky or Confident yet; `idea_used = 'none'`
 * means they haven't selected a suggested idea.
 */
export const defaultApplicationStarterSessionContext: ApplicationStarterSessionContext =
  {
    mode_used: 'none',
    idea_used: 'none',
  }
