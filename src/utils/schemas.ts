/**
 * Shared Valibot schemas for validation
 * Uses constants from db/types.ts as single source of truth
 */
import * as v from 'valibot'
import {
  CAPABILITIES,
  OAUTH_PROVIDERS,
  DOC_FEEDBACK_TYPES,
  DOC_FEEDBACK_STATUSES,
  BANNER_SCOPES,
  BANNER_STYLES,
  ENTRY_TYPES,
  SHOWCASE_STATUSES,
  SHOWCASE_USE_CASES,
  AUDIT_ACTIONS,
  RELEASE_LEVELS,
  FEED_VIEW_MODES,
} from '~/db/types'
import { libraryIds } from '~/libraries'

// Valibot schemas derived from constants
export const capabilitySchema = v.picklist([...CAPABILITIES])
export const oauthProviderSchema = v.picklist([...OAUTH_PROVIDERS])
export const docFeedbackTypeSchema = v.picklist([...DOC_FEEDBACK_TYPES])
export const docFeedbackStatusSchema = v.picklist([...DOC_FEEDBACK_STATUSES])
export const bannerScopeSchema = v.picklist([...BANNER_SCOPES])
export const bannerStyleSchema = v.picklist([...BANNER_STYLES])
export const entryTypeSchema = v.picklist([...ENTRY_TYPES])
export const showcaseStatusSchema = v.picklist([...SHOWCASE_STATUSES])
export const showcaseUseCaseSchema = v.picklist([...SHOWCASE_USE_CASES])
export const auditActionSchema = v.picklist([...AUDIT_ACTIONS])
export const releaseLevelSchema = v.picklist([...RELEASE_LEVELS])
export const feedViewModeSchema = v.picklist([...FEED_VIEW_MODES])

// Library ID schema - derived from libraries config
export const libraryIdSchema = v.picklist([...libraryIds])
