import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ProductClient from './ProductClient'
import { JsonLd } from '@/components/seo/JsonLd'
import {
  breadcrumbSchema,
  productSchema,
} from '@/lib/seo/schemas'

import { SEO_CONFIG } from '@/lib/seo/config'
import {
  absoluteUrl,
  cleanText,
  truncateDescription,
} from '@/lib/seo/utils'

interface Product {
  id: string
  slug: string
  name: string
  description: string
  price: number
  compareAtPrice?: number | null
  discountPercent: number
  stock: number
  inStock: boolean
  images?: string[]
  weight?: number | null
  unit?: string | null
  tags?: string[]
  category?: {
    name: string
    slug: string
  } | null
}

async function getProduct(id: string): Promise<Product | null> {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_URL ||
      SEO_CONFIG.siteUrl

    const response = await fetch(
      `${baseUrl.replace(/\/+$/, '')}/api/products/${encodeURIComponent(id)}`,
      {
        next: {
          revalidate: 300,
        },
      }
    )

    if (!response.ok) {
      return null
    }

    return (await response.json()) as Product
  } catch (error) {
    console.error('Failed to fetch product:', error)
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params

  const product = await getProduct(id)

  if (!product) {
    return {
      title: 'Product Not Found | HomeShoppie',
      description: 'The requested product could not be found.',
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const description =
    truncateDescription(cleanText(product.description)) ||
    `Buy ${product.name} online from HomeShoppie.`

  const productUrl = absoluteUrl(`/products/${product.id}`)

  const image =
    product.images && product.images.length > 0
      ? product.images[0]
      : undefined

  const imageUrl = image
    ? image.startsWith('http')
      ? image
      : absoluteUrl(image)
    : undefined

  return {
    title: `${product.name} | Buy Online | HomeShoppie`,

    description,

    alternates: {
      canonical: productUrl,
    },

    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },

    openGraph: {
      type: 'website',
      locale: SEO_CONFIG.locale,
      url: productUrl,
      siteName: SEO_CONFIG.siteName,
      title: `${product.name} | Buy Online | HomeShoppie`,
      description,

      ...(imageUrl
        ? {
            images: [
              {
                url: imageUrl,
                alt: `${product.name} - HomeShoppie`,
              },
            ],
          }
        : {}),
    },

    twitter: {
      card: 'summary_large_image',
      title: `${product.name} | Buy Online | HomeShoppie`,
      description,

      ...(imageUrl
        ? {
            images: [imageUrl],
          }
        : {}),
    },
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const product = await getProduct(id)

  if (!product) {
    notFound()
  }

  const productUrl = absoluteUrl(`/products/${product.id}`)

  const productImage =
    product.images && product.images.length > 0
      ? product.images[0]
      : undefined

  const breadcrumbItems = [
    {
      name: 'Home',
      url: SEO_CONFIG.siteUrl,
    },
    {
      name: 'Products',
      url: absoluteUrl('/products'),
    },
  ]

  if (product.category) {
    breadcrumbItems.push({
      name: product.category.name,
      url: absoluteUrl(
        `/categories/${product.category.slug}`
      ),
    })
  }

  breadcrumbItems.push({
    name: product.name,
    url: productUrl,
  })

  const productJsonLd = productSchema({
    id: product.id,
    name: product.name,
    description:
      cleanText(product.description) ||
      `Buy ${product.name} online from HomeShoppie.`,
    image: productImage,
    sku: product.slug,
    price: product.price,
    currency: 'INR',
    available: product.inStock,
  })

  const breadcrumbJsonLd =
    breadcrumbSchema(breadcrumbItems)

  return (
    <>
      <JsonLd data={productJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <ProductClient />
    </>
  )
}