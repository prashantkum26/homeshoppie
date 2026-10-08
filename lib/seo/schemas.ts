import { SEO_CONFIG } from './config'
import { absoluteUrl } from './utils'

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SEO_CONFIG.siteUrl}/#organization`,
    name: SEO_CONFIG.organization.name,
    url: SEO_CONFIG.siteUrl,
    logo: {
      '@type': 'ImageObject',
      url: absoluteUrl('/images/logo.png'),
    },
  }
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SEO_CONFIG.siteUrl}/#website`,
    url: SEO_CONFIG.siteUrl,
    name: SEO_CONFIG.siteName,
    publisher: {
      '@id': `${SEO_CONFIG.siteUrl}/#organization`,
    },
    inLanguage: 'en-IN',
  }
}

export function breadcrumbSchema(
  items: Array<{
    name: string
    url: string
  }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',

    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

/**
 * Product structured data
 *
 * Used on:
 * /products/[id]
 */
interface ProductSchemaInput {
  id: string
  name: string
  description: string
  image?: string | undefined
  sku?: string | undefined
  price: number
  currency?: string | undefined
  available: boolean
}

export function productSchema(
  product: ProductSchemaInput
) {
  const productUrl = absoluteUrl(
    `/products/${product.id}`
  )

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${productUrl}#product`,

    name: product.name,

    description: product.description,

    url: productUrl,

    ...(product.image
      ? {
          image: [
            product.image.startsWith('http')
              ? product.image
              : absoluteUrl(product.image),
          ],
        }
      : {}),

    ...(product.sku
      ? {
          sku: product.sku,
        }
      : {}),

    offers: {
      '@type': 'Offer',

      url: productUrl,

      priceCurrency: product.currency || 'INR',

      price: product.price,

      availability: product.available
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',

      itemCondition:
        'https://schema.org/NewCondition',
    },
  }
}