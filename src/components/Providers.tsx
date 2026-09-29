'use client'

import { SessionProvider } from 'next-auth/react'
import useSessionSync from '@/hooks/useSessionSync'
// import CartSyncProvider from './CartSyncProvider'

interface ProvidersProps {
  children: React.ReactNode
}

function SessionSyncWrapper({ children }: { children: React.ReactNode }) {
  useSessionSync()

  return <>{children}</>
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <SessionSyncWrapper>
        {/* <CartSyncProvider /> */}
        {children}
      </SessionSyncWrapper>
    </SessionProvider>
  )
}