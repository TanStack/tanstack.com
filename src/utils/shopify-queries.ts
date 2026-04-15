import type {
  Cart,
  CartLine,
  Collection,
  Image as StorefrontImage,
  MoneyV2,
  Product,
  ProductOption,
  ProductVariant,
} from '@shopify/hydrogen-react/storefront-api-types'

/**
 * GraphQL queries for the Shopify Storefront API.
 *
 * Result types are hand-picked slices of the full `@shopify/hydrogen-react`
 * Storefront API types. When the query count grows we can swap to
 * `@shopify/hydrogen-codegen` and regenerate; the consuming code won't
 * change because the type shapes match exactly.
 */

/* ──────────────────────────────────────────────────────────────────────────
 * Shop info — used by the smoke test and the shop landing header
 * ────────────────────────────────────────────────────────────────────────── */

export const SHOP_QUERY = /* GraphQL */ `
  query Shop {
    shop {
      name
      description
      primaryDomain {
        url
      }
    }
  }
`

export type ShopQueryResult = {
  shop: {
    name: string
    description: string | null
    primaryDomain: { url: string }
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Product list — used by /shop landing
 * ────────────────────────────────────────────────────────────────────────── */

export const PRODUCTS_QUERY = /* GraphQL */ `
  query Products($first: Int!) {
    products(first: $first, sortKey: BEST_SELLING) {
      nodes {
        id
        handle
        title
        featuredImage {
          url
          altText
          width
          height
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
      }
    }
  }
`

export type ProductListItem = Pick<Product, 'id' | 'handle' | 'title'> & {
  featuredImage:
    | (Pick<StorefrontImage, 'url' | 'altText' | 'width' | 'height'> | null)
    | null
  priceRange: {
    minVariantPrice: Pick<MoneyV2, 'amount' | 'currencyCode'>
  }
}

export type ProductsQueryResult = {
  products: { nodes: Array<ProductListItem> }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Single product (PDP) — used by /shop/products/$handle
 * ────────────────────────────────────────────────────────────────────────── */

export const PRODUCT_QUERY = /* GraphQL */ `
  query Product($handle: String!) {
    product(handle: $handle) {
      id
      handle
      title
      descriptionHtml
      options {
        id
        name
        values
      }
      images(first: 10) {
        nodes {
          url
          altText
          width
          height
        }
      }
      variants(first: 100) {
        nodes {
          id
          title
          availableForSale
          selectedOptions {
            name
            value
          }
          price {
            amount
            currencyCode
          }
          image {
            url
            altText
            width
            height
          }
        }
      }
      seo {
        title
        description
      }
    }
  }
`

export type ProductDetailVariant = Pick<
  ProductVariant,
  'id' | 'title' | 'availableForSale'
> & {
  selectedOptions: Array<{ name: string; value: string }>
  price: Pick<MoneyV2, 'amount' | 'currencyCode'>
  image: Pick<StorefrontImage, 'url' | 'altText' | 'width' | 'height'> | null
}

export type ProductDetail = Pick<
  Product,
  'id' | 'handle' | 'title' | 'descriptionHtml'
> & {
  options: Array<Pick<ProductOption, 'id' | 'name' | 'values'>>
  images: {
    nodes: Array<Pick<StorefrontImage, 'url' | 'altText' | 'width' | 'height'>>
  }
  variants: { nodes: Array<ProductDetailVariant> }
  seo: { title: string | null; description: string | null }
}

export type ProductQueryResult = {
  product: ProductDetail | null
}

/* ──────────────────────────────────────────────────────────────────────────
 * Collections list — used to drive the /shop sidebar
 * ────────────────────────────────────────────────────────────────────────── */

export const COLLECTIONS_QUERY = /* GraphQL */ `
  query Collections($first: Int!) {
    collections(first: $first, sortKey: TITLE) {
      nodes {
        id
        handle
        title
        description
      }
    }
  }
`

export type CollectionListItem = Pick<
  Collection,
  'id' | 'handle' | 'title' | 'description'
>

export type CollectionsQueryResult = {
  collections: { nodes: Array<CollectionListItem> }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Cart — queries + mutations
 *
 * The cart lives in Shopify. We hit the Storefront API directly from the
 * browser with the public token (no server hop needed), and manage the cart
 * ID client-side via localStorage. Checkout redirects to `cart.checkoutUrl`
 * which is Shopify-hosted.
 * ────────────────────────────────────────────────────────────────────────── */

const CART_FRAGMENT = /* GraphQL */ `
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    cost {
      totalAmount {
        amount
        currencyCode
      }
      subtotalAmount {
        amount
        currencyCode
      }
      totalTaxAmount {
        amount
        currencyCode
      }
    }
    lines(first: 100) {
      nodes {
        id
        quantity
        merchandise {
          ... on ProductVariant {
            id
            title
            availableForSale
            selectedOptions {
              name
              value
            }
            price {
              amount
              currencyCode
            }
            image {
              url
              altText
              width
              height
            }
            product {
              handle
              title
            }
          }
        }
        cost {
          totalAmount {
            amount
            currencyCode
          }
        }
      }
    }
  }
`

export const CART_QUERY = /* GraphQL */ `
  ${CART_FRAGMENT}
  query Cart($cartId: ID!) {
    cart(id: $cartId) {
      ...CartFields
    }
  }
`

export const CART_CREATE_MUTATION = /* GraphQL */ `
  ${CART_FRAGMENT}
  mutation CartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        ...CartFields
      }
      userErrors {
        field
        message
      }
    }
  }
`

export const CART_LINES_ADD_MUTATION = /* GraphQL */ `
  ${CART_FRAGMENT}
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        ...CartFields
      }
      userErrors {
        field
        message
      }
    }
  }
`

export const CART_LINES_UPDATE_MUTATION = /* GraphQL */ `
  ${CART_FRAGMENT}
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart {
        ...CartFields
      }
      userErrors {
        field
        message
      }
    }
  }
`

export const CART_LINES_REMOVE_MUTATION = /* GraphQL */ `
  ${CART_FRAGMENT}
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart {
        ...CartFields
      }
      userErrors {
        field
        message
      }
    }
  }
`

export type CartLineMerchandise = Pick<
  ProductVariant,
  'id' | 'title' | 'availableForSale'
> & {
  selectedOptions: Array<{ name: string; value: string }>
  price: Pick<MoneyV2, 'amount' | 'currencyCode'>
  image: Pick<StorefrontImage, 'url' | 'altText' | 'width' | 'height'> | null
  product: Pick<Product, 'handle' | 'title'>
}

export type CartLineDetail = Pick<CartLine, 'id' | 'quantity'> & {
  merchandise: CartLineMerchandise
  cost: {
    totalAmount: Pick<MoneyV2, 'amount' | 'currencyCode'>
  }
}

export type CartDetail = Pick<Cart, 'id' | 'checkoutUrl' | 'totalQuantity'> & {
  cost: {
    totalAmount: Pick<MoneyV2, 'amount' | 'currencyCode'>
    subtotalAmount: Pick<MoneyV2, 'amount' | 'currencyCode'>
    totalTaxAmount: Pick<MoneyV2, 'amount' | 'currencyCode'> | null
  }
  lines: { nodes: Array<CartLineDetail> }
}

export type CartQueryResult = {
  cart: CartDetail | null
}

export type CartUserError = { field: string[] | null; message: string }

export type CartCreateResult = {
  cartCreate: { cart: CartDetail | null; userErrors: Array<CartUserError> }
}

export type CartLinesAddResult = {
  cartLinesAdd: { cart: CartDetail | null; userErrors: Array<CartUserError> }
}

export type CartLinesUpdateResult = {
  cartLinesUpdate: {
    cart: CartDetail | null
    userErrors: Array<CartUserError>
  }
}

export type CartLinesRemoveResult = {
  cartLinesRemove: {
    cart: CartDetail | null
    userErrors: Array<CartUserError>
  }
}
