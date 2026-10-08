import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import CategoryClient from './CategoryClient'

import { JsonLd } from '@/components/seo/JsonLd'
import { breadcrumbSchema } from '@/lib/seo/schemas'
import { SEO_CONFIG } from '@/lib/seo/config'
import {
  absoluteUrl,
  cleanText,
  truncateDescription,
} from '@/lib/seo/utils'

interface Category {
  id: string
  name: string
  description: string
  slug: string
  image?: string
}

async function getCategory(
  slug: string
): Promise<Category | null> {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_URL ||
      SEO_CONFIG.siteUrl

    const response = await fetch(
      `${baseUrl.replace(/\/+$/, '')}/api/categories`,
      {
        next: {
          revalidate: 300,
        },
      }
    )

    if (!response.ok) {
      return null
    }

    const result = await response.json()

    const categories =
      result.success
        ? result.data
        : result.categories || result || []

    if (!Array.isArray(categories)) {
      return null
    }

    return (
      categories.find(
        (category: Category) => category.slug === slug
      ) || null
    )
  } catch (error) {
    console.error('Failed to fetch category:', error)
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params

  const category = await getCategory(slug)

  if (!category) {
    return {
      title: 'Category Not Found | HomeShoppie',
      description:
        'The requested category could not be found.',
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const description =
    truncateDescription(
      cleanText(category.description)
    ) ||
    `Shop ${category.name} online at HomeShoppie.`

  const categoryUrl = absoluteUrl(
    `/categories/${category.slug}`
  )

  const imageUrl = category.image
    ? category.image.startsWith('http')
      ? category.image
      : absoluteUrl(category.image)
    : undefined

  return {
    title: `Buy ${category.name} Online | HomeShoppie`,

    description,

    alternates: {
      canonical: categoryUrl,
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
      url: categoryUrl,
      siteName: SEO_CONFIG.siteName,
      title: `Buy ${category.name} Online | HomeShoppie`,
      description,

      ...(imageUrl
        ? {
            images: [
              {
                url: imageUrl,
                alt: `${category.name} - HomeShoppie`,
              },
            ],
          }
        : {}),
    },

    twitter: {
      card: 'summary_large_image',
      title: `Buy ${category.name} Online | HomeShoppie`,
      description,

      ...(imageUrl
        ? {
            images: [imageUrl],
          }
        : {}),
    },
  }
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const category = await getCategory(slug)

  if (!category) {
    notFound()
  }

  const categoryUrl = absoluteUrl(
    `/categories/${category.slug}`
  )

  const breadcrumbJsonLd = breadcrumbSchema([
    {
      name: 'Home',
      url: SEO_CONFIG.siteUrl,
    },
    {
      name: 'Categories',
      url: absoluteUrl('/categories'),
    },
    {
      name: category.name,
      url: categoryUrl,
    },
  ])

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <CategoryClient />
    </>
  )
}