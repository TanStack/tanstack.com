import { env } from '~/utils/env'

type ShopifyFetchInput<TVariables> = {
  query: string
  variables?: TVariables
  /**
   * Optional buyer IP, forwarded to Shopify's bot-protection headers.
   * Only meaningful with the private token.
   */
  buyerIp?: string
}

type ShopifyResponse<TData> = {
  data?: TData
  errors?: Array<{ message: string; locations?: unknown; path?: unknown }>
}

class ShopifyError extends Error {
  constructor(
    message: string,
    public readonly errors?: ShopifyResponse<unknown>['errors'],
  ) {
    super(message)
    this.name = 'ShopifyError'
  }
}

/**
 * Server-side Storefront API client. Uses the private access token, which has
 * higher rate limits and supports buyer-IP forwarding for bot protection.
 *
 * Use this in route loaders and server functions only — never in browser code.
 */
export async function shopifyServerFetch<
  TData,
  TVariables = Record<string, unknown>,
>(input: ShopifyFetchInput<TVariables>): Promise<TData> {
  const domain = env.SHOPIFY_STORE_DOMAIN
  const token = env.SHOPIFY_PRIVATE_STOREFRONT_TOKEN
  const version = env.SHOPIFY_API_VERSION

  if (!domain || !token) {
    throw new ShopifyError(
      'Shopify server client is not configured. Set SHOPIFY_STORE_DOMAIN and SHOPIFY_PRIVATE_STOREFRONT_TOKEN in .env.local.',
    )
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Shopify-Storefront-Private-Token': token,
  }
  if (input.buyerIp) headers['Shopify-Storefront-Buyer-IP'] = input.buyerIp

  const response = await fetch(
    `https://${domain}/api/${version}/graphql.json`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: input.query, variables: input.variables }),
    },
  )

  if (!response.ok) {
    throw new ShopifyError(
      `Shopify API error: ${response.status} ${response.statusText}`,
    )
  }

  const json = (await response.json()) as ShopifyResponse<TData>

  if (json.errors?.length) {
    throw new ShopifyError(
      json.errors.map((e) => e.message).join('\n'),
      json.errors,
    )
  }

  if (!json.data) {
    throw new ShopifyError('Shopify API returned no data and no errors.')
  }

  return json.data
}
