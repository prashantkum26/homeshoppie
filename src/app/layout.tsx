import { Geist, Geist_Mono } from 'next/font/google'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'

import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Providers from '@/components/Providers'
import { SEO_CONFIG } from '@/lib/seo/config'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  metadataBase: new URL(SEO_CONFIG.siteUrl),

  title: {
    default: SEO_CONFIG.defaultTitle,
    template: SEO_CONFIG.titleTemplate,
  },

  description: SEO_CONFIG.description,
  keywords: [...SEO_CONFIG.keywords],
  applicationName: SEO_CONFIG.siteName,

  authors: [
    {
      name: SEO_CONFIG.siteName,
      url: SEO_CONFIG.siteUrl,
    },
  ],

  creator: SEO_CONFIG.siteName,
  publisher: SEO_CONFIG.siteName,

  alternates: {
    canonical: SEO_CONFIG.siteUrl,
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
    locale: 'en_IN',
    url: SEO_CONFIG.siteUrl,
    siteName: SEO_CONFIG.siteName,
    title: SEO_CONFIG.defaultTitle,
    description: SEO_CONFIG.description,
    images: [
      {
        url: '/images/og/homepage.jpg',
        width: 1200,
        height: 630,
        alt: 'HomeShoppie - Authentic Indian Foods & Products',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: SEO_CONFIG.defaultTitle,
    description: SEO_CONFIG.description,
    images: ['/images/og/homepage.jpg'],
  },

  icons: {
    icon: [
      {
        url: '/favicon/favicon.svg',
        type: 'image/svg+xml',
      },
      {
        url: '/favicon/favicon-96x96.png',
        type: 'image/png',
        sizes: '96x96',
      },
      {
        url: '/favicon/favicon.ico',
        type: 'image/x-icon',
      },
    ],
    apple: [
      {
        url: '/favicon/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },

  manifest: '/favicon/site.webmanifest',
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default async function RootLayout({
  children,
}: RootLayoutProps) {
  // Read the request-specific CSP nonce supplied by src/proxy.ts.
  await headers()

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable}`}
      >
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Header />

            <main className="flex-1">{children}</main>

            <Footer />
          </div>

          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}