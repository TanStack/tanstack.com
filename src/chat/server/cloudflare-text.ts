import {
  CloudflareTextAdapter,
  type CloudflareTextConfig,
} from '@tanstack/ai-cloudflare'
import type { TextOptions } from '@tanstack/ai'

/** Hosted-model compatibility, separate from application argument validation. */
class GumCloudflareTextAdapter extends CloudflareTextAdapter<string> {
  private readonly strictTools: boolean

  constructor(model: string, config: CloudflareTextConfig) {
    super(config, model)
    // Fixed-payload trials isolate heading-only output to strict generation on
    // this hosted model. Do not infer the same limitation for other endpoints.
    this.strictTools = model !== '@cf/moonshotai/kimi-k2.6'
  }

  protected override mapOptionsToRequest(options: TextOptions) {
    const request = super.mapOptionsToRequest(options)
    if (this.strictTools || !request.tools) return request
    return {
      ...request,
      tools: request.tools.map((tool) =>
        tool.type === 'function'
          ? { ...tool, function: { ...tool.function, strict: false } }
          : tool,
      ),
    }
  }
}

export function createGumCloudflareText(
  model: string,
  config: CloudflareTextConfig,
) {
  return new GumCloudflareTextAdapter(model, config)
}
