import type { MetadataRoute } from 'next'
import { SEO_CONFIG } from '@/lib/seo/config'
import { prisma } from '@/lib/prisma'

async function getSitemapProducts() {
  return prisma.product.findMany({
    select: {
      id: true,
      updatedAt: true,
    },
  })
}

async function getSitemapCategories() {
  return prisma.category.findMany({
    select: {
      slug: true,
      updatedAt: true,
    },
  })
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SEO_CONFIG.siteUrl,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },

    {
      url: `${SEO_CONFIG.siteUrl}/products`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },

    {
      url: `${SEO_CONFIG.siteUrl}/categories`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },

    {
      url: `${SEO_CONFIG.siteUrl}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },

    {
      url: `${SEO_CONFIG.siteUrl}/contact`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },

    {
      url: `${SEO_CONFIG.siteUrl}/faq`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },

    {
      url: `${SEO_CONFIG.siteUrl}/shipping`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },

    {
      url: `${SEO_CONFIG.siteUrl}/returns`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ]

  const [products, categories] = await Promise.all([
    getSitemapProducts(),
    getSitemapCategories(),
  ])

  const productPages: MetadataRoute.Sitemap =
    products.map((product) => ({
      url: `${SEO_CONFIG.siteUrl}/products/${product.id}`,

      lastModified:
        product.updatedAt || now,

      changeFrequency: 'weekly',

      priority: 0.8,
    }))

  const categoryPages: MetadataRoute.Sitemap =
    categories.map((category) => ({
      url: `${SEO_CONFIG.siteUrl}/categories/${category.slug}`,

      lastModified:
        category.updatedAt || now,

      changeFrequency: 'weekly',

      priority: 0.8,
    }))

  return [
    ...staticPages,
    ...categoryPages,
    ...productPages,
  ]
}