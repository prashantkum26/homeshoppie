'use client'

import { SessionProvider } from 'next-auth/react'
import type { Session } from 'next-auth'
import useSessionSync from '@/hooks/useSessionSync'

interface ProvidersProps {
  children: React.ReactNode
  session?: Session | null
}

function SessionSyncWrapper({ children }: { children: React.ReactNode }) {
  useSessionSync()
  return <>{children}</>
}

export default function Providers({ children, session }: ProvidersProps) {
  return (
    <SessionProvider session={session ?? null}>
      <SessionSyncWrapper>
        {children}
      </SessionSyncWrapper>
    </SessionProvider>
  )
}
