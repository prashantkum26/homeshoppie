import type { Metadata } from 'next'
import { headers } from 'next/headers'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await headers()
  return children
}