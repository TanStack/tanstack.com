export {
  getFeaturesHandler,
  type FeaturesResponse,
  type FeatureInfo,
  type FeatureOption,
  type TemplateInfo,
} from './features'

export {
  compileHandler,
  compileWithAttributionHandler,
  type ProjectDefinition,
  type CompileRequest,
  type CompileResponse,
  type CompileHandlerOptions,
} from './compile'

export {
  validateHandler,
  type ValidationError,
  type ValidationSuggestion,
  type ValidateResponse,
} from './validate'

export {
  suggestHandler,
  type SuggestRequest,
  type SuggestResponse,
  type FeatureSuggestion,
} from './suggest'

export {
  featureArtifactsHandler,
  type FeatureArtifactsRequest,
  type FeatureArtifactsResponse,
  type FeatureArtifact,
} from './feature-artifacts'

export {
  loadRemoteIntegrationHandler,
  loadRemoteTemplateHandler,
  type RemoteIntegrationResponse,
  type RemoteTemplateResponse,
} from './remote'

export type {
  AttributedCompileOutput,
  IntegrationCompiled,
  CustomTemplateCompiled,
} from '@tanstack/cli'

export type FeatureId = string
