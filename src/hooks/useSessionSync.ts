'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import useWishlistStore from '@/store/wishlistStore'

export default function useSessionSync() {
  const { data: session, status } = useSession()
  const fetchFromServer = useWishlistStore((state) => state.fetchFromServer)
  const syncedRef = useRef(false)
  const lastUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    let isMounted = true
    
    // Only sync once per user session change
    if (status === 'authenticated' && session?.user?.id) {
      const currentUserId = session.user.id
      
      // Check if we already synced for this user or if user changed
      if (!syncedRef.current || lastUserIdRef.current !== currentUserId) {
        syncedRef.current = true
        lastUserIdRef.current = currentUserId
        
        // Delay slightly to avoid conflicts with page-level API calls
        const timer = setTimeout(() => {
          if (isMounted) {
            fetchFromServer().catch((error) => {
              console.error('Failed to sync wishlist on session change:', error)
            })
          }
        }, 100)
        
        return () => {
          clearTimeout(timer)
          isMounted = false
        }
      }
    } else if (status === 'unauthenticated') {
      // Reset sync flag when logged out
      syncedRef.current = false
      lastUserIdRef.current = null
    }

    return () => {
      isMounted = false
    }
  }, [status, session?.user?.id]) // Removed fetchFromServer from dependencies

  return { session, status }
}
