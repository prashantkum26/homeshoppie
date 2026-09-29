'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'

import useWishlistStore from '@/store/wishlistStore'
import useCartStore from '@/store/cartStore'

export default function useSessionSync() {
  const {
    data: session,
    status,
  } = useSession()

  const fetchFromServer =
    useWishlistStore(
      (state) => state.fetchFromServer
    )

  const mergeCartOnLogin =
    useCartStore(
      (state) => state.mergeCartOnLogin
    )

  const clearLocalCart =
    useCartStore(
      (state) => state.clearLocalCart
    )

  const setLoggedIn =
    useCartStore(
      (state) => state.setLoggedIn
    )

  /*
   * User ID whose synchronization completed
   * successfully.
   */
  const syncedUserIdRef =
    useRef<string | null>(null)

  /*
   * Prevent duplicate simultaneous
   * synchronization.
   */
  const syncingRef =
    useRef(false)

  useEffect(() => {
    /*
     * ------------------------------------------------------------
     * NEXTAUTH LOADING
     * ------------------------------------------------------------
     */
    if (status === 'loading') {
      return
    }

    /*
     * ------------------------------------------------------------
     * AUTHENTICATED
     * ------------------------------------------------------------
     */
    if (
      status === 'authenticated' &&
      session?.user?.id
    ) {
      const userId = session.user.id

      /*
       * Already synchronized successfully
       * for this exact user.
       */
      if (
        syncedUserIdRef.current === userId
      ) {
        return
      }

      /*
       * Prevent duplicate merge calls.
       */
      if (syncingRef.current) {
        return
      }

      syncingRef.current = true

      /*
       * NextAuth is the source of truth.
       */
      setLoggedIn(true)

      const synchronize = async () => {
        try {
          console.log(
            '[SessionSync] Starting synchronization:',
            userId
          )

          /*
           * ------------------------------------------------------
           * CART
           *
           * mergeCartOnLogin() performs:
           *
           * guest cart
           *     ↓
           * POST /api/cart
           *     ↓
           * GET /api/cart
           *     ↓
           * authenticated Zustand cart
           * ------------------------------------------------------
           */
          await mergeCartOnLogin(userId)

          /*
           * ------------------------------------------------------
           * WISHLIST
           * ------------------------------------------------------
           */
          await fetchFromServer()

          /*
           * IMPORTANT:
           *
           * Only mark the user as synchronized after
           * everything completed successfully.
           */
          syncedUserIdRef.current = userId

          console.log(
            '[SessionSync] Synchronization completed:',
            userId
          )
        } catch (error) {
          /*
           * DO NOT mark syncedUserIdRef.
           *
           * This allows a later session update/retry.
           *
           * Guest cart is preserved by mergeCartOnLogin().
           */
          console.error(
            '[SessionSync] Synchronization failed:',
            error
          )
        } finally {
          syncingRef.current = false
        }
      }

      synchronize()

      return
    }

    /*
     * ------------------------------------------------------------
     * UNAUTHENTICATED
     * ------------------------------------------------------------
     */
    if (status === 'unauthenticated') {
      syncedUserIdRef.current = null
      syncingRef.current = false

      /*
       * IMPORTANT:
       *
       * clearLocalCart() clears ONLY the authenticated
       * Zustand cart.
       *
       * guestItems remain persisted.
       */
      clearLocalCart()
    }
  }, [
    status,
    session?.user?.id,
    fetchFromServer,
    mergeCartOnLogin,
    clearLocalCart,
    setLoggedIn,
  ])

  return {
    session,
    status,
  }
}