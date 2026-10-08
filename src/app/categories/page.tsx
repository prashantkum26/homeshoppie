import type { Metadata } from 'next'

import CategoriesClient from './CategoriesClient'

import { JsonLd } from '@/components/seo/JsonLd'
import { breadcrumbSchema } from '@/lib/seo/schemas'
import { SEO_CONFIG } from '@/lib/seo/config'
import { absoluteUrl } from '@/lib/seo/utils'

export const metadata: Metadata = {
  title: 'Shop Indian Food & Products by Category | HomeShoppie',

  description:
    'Explore HomeShoppie categories and shop authentic Indian foods, traditional snacks, groceries, pooja items and more online.',

  alternates: {
    canonical: absoluteUrl('/categories'),
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
    url: absoluteUrl('/categories'),
    siteName: SEO_CONFIG.siteName,
    title: 'Shop Indian Food & Products by Category | HomeShoppie',
    description:
      'Explore HomeShoppie categories and shop authentic Indian foods, traditional snacks, groceries, pooja items and more online.',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'Shop Indian Food & Products by Category | HomeShoppie',
    description:
      'Explore HomeShoppie categories and shop authentic Indian foods, traditional snacks, groceries, pooja items and more online.',
  },
}

export default function CategoriesPage() {
  const breadcrumbJsonLd = breadcrumbSchema([
    {
      name: 'Home',
      url: SEO_CONFIG.siteUrl,
    },
    {
      name: 'Categories',
      url: absoluteUrl('/categories'),
    },
  ])

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />

      <CategoriesClient />
    </>
  )
}