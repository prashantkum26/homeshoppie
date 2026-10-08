import type { Metadata } from 'next'
import { SEO_CONFIG } from './config'
import {
  absoluteUrl,
  truncateDescription,
} from './utils'

interface CreateMetadataOptions {
  title: string
  description: string
  path?: string
  image?: string
  type?: 'website' | 'article'
  noIndex?: boolean
}

export function createMetadata({
  title,
  description,
  path = '/',
  image,
  type = 'website',
  noIndex = false,
}: CreateMetadataOptions): Metadata {
  const url = absoluteUrl(path)

  const imageUrl = image
    ? image.startsWith('http')
      ? image
      : absoluteUrl(image)
    : absoluteUrl('/images/og/homepage.jpg')

  return {
    title,
    description: truncateDescription(description),

    metadataBase: new URL(SEO_CONFIG.siteUrl),

    alternates: {
      canonical: url,
    },

    robots: noIndex
      ? {
          index: false,
          follow: false,
          googleBot: {
            index: false,
            follow: false,
          },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
          },
        },

    openGraph: {
      type,
      locale: SEO_CONFIG.locale,
      url,
      siteName: SEO_CONFIG.siteName,
      title,
      description: truncateDescription(description),
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },

    twitter: {
      card: 'summary_large_image',
      title,
      description: truncateDescription(description),
      images: [imageUrl],
    },
  }
}