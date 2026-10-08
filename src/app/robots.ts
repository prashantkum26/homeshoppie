import type { MetadataRoute } from 'next'
import { SEO_CONFIG } from '@/lib/seo/config'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',

        allow: [
          '/',
          '/products',
          '/products/',
          '/categories',
          '/categories/',
          '/about',
          '/contact',
          '/faq',
          '/shipping',
          '/returns',
        ],

        disallow: [
          '/api/',
          '/admin/',
          '/dashboard/',
          '/auth/',
          '/cart',
          '/checkout',
          '/orders/',
          '/wishlist',
          '/track-order',
        ],
      },
    ],

    sitemap: `${SEO_CONFIG.siteUrl}/sitemap.xml`,
  }
}