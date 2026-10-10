import type { Metadata } from 'next'
import { headers } from 'next/headers' // <-- ADD THIS

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

// Ensure the component is async
// Ensure the component is async
export default async function CategoriesPage() {
  // Opts the page into dynamic rendering so Next.js applies the middleware's nonce to its scripts
  const headersList = await headers() // <-- ADD 'await' HERE
  const nonce = headersList.get('x-nonce') || undefined

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
      <JsonLd data={breadcrumbJsonLd} nonce={nonce} />
      <CategoriesClient />
    </>
  )
}