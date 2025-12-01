'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import useWishlistStore from '@/store/wishlistStore'

export default function useSessionSync() {
  const { data: session, status } = useSession()
  const fetchFromServer = useWishlistStore((state) => state.fetchFromServer)

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      // User is authenticated, sync wishlist
      fetchFromServer().catch((error) => {
        console.error('Failed to sync wishlist on session change:', error)
      })
    }
    // Note: We don't clear wishlist on logout to preserve user's local wishlist
  }, [status, session?.user?.id, fetchFromServer])

  return { session, status }
}
