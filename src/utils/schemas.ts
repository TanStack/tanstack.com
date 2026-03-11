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
  SHOWCASE_STATUSES,
  SHOWCASE_USE_CASES,
  AUDIT_ACTIONS,
  RELEASE_LEVELS,
} from '~/db/types'
import { libraryIds } from '~/libraries'

// Valibot schemas derived from constants
export const capabilitySchema = v.picklist([...CAPABILITIES])
export const oauthProviderSchema = v.picklist([...OAUTH_PROVIDERS])
export const docFeedbackTypeSchema = v.picklist([...DOC_FEEDBACK_TYPES])
export const docFeedbackStatusSchema = v.picklist([...DOC_FEEDBACK_STATUSES])
export const showcaseStatusSchema = v.picklist([...SHOWCASE_STATUSES])
export const showcaseUseCaseSchema = v.picklist([...SHOWCASE_USE_CASES])
export const auditActionSchema = v.picklist([...AUDIT_ACTIONS])
export const releaseLevelSchema = v.picklist([...RELEASE_LEVELS])

// Library ID schema - derived from libraries config
export const libraryIdSchema = v.picklist([...libraryIds])
