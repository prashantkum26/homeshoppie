import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product } from '@/types'

export interface CartItem extends Product {
  quantity: number

  /**
   * Database CartItem.id.
   *
   * Only exists when this product has been persisted
   * into the authenticated user's database cart.
   */
  cartItemId?: string
}

interface CartStore {
  /**
   * Authenticated user's server cart.
   *
   * These items normally have cartItemId.
   */
  items: CartItem[]

  /**
   * Guest/local cart.
   *
   * cartItemId should normally be undefined.
   */
  guestItems: CartItem[]

  isLoading: boolean

  /**
   * Kept for compatibility with existing UI.
   * Authentication truth should come from NextAuth.
   */
  isLoggedIn: boolean

  setLoggedIn: (status: boolean) => void

  addItem: (
    product: Product,
    quantity?: number
  ) => Promise<void>

  removeItem: (
    productId: string
  ) => Promise<void>

  updateQuantity: (
    productId: string,
    quantity: number
  ) => Promise<void>

  clearCart: () => Promise<void>

  clearLocalCart: () => void

  syncWithServer: () => Promise<void>

  mergeCartOnLogin: (
    userId: string
  ) => Promise<void>

  getTotal: () => number

  getTotalItems: () => number
}

const getErrorMessage = async (
  response: Response
): Promise<string> => {
  try {
    const data = await response.json()

    if (typeof data?.error === 'string') {
      return data.error
    }
  } catch {
    // Ignore invalid JSON
  }

  return `Request failed with status ${response.status}`
}

const mapServerCartItem = (
  item: any
): CartItem => ({
  ...item.product,
  quantity: item.quantity,

  // IMPORTANT:
  // item.id = CartItem.id
  cartItemId: item.id,
})

const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      guestItems: [],

      isLoading: false,

      isLoggedIn: false,

      setLoggedIn: (status) => {
        set({
          isLoggedIn: status,
        })
      },

      /**
       * Add product.
       *
       * Guest:
       *   local only
       *
       * Authenticated:
       *   POST /api/cart
       */
      addItem: async (
        product,
        quantity = 1
      ) => {
        if (
          !Number.isInteger(quantity) ||
          quantity < 1
        ) {
          throw new Error(
            'Quantity must be a positive integer'
          )
        }

        const isLoggedIn = get().isLoggedIn

        if (!isLoggedIn) {
          set((state) => {
            const existing = state.guestItems.find(
              (item) => item.id === product.id
            )

            if (existing) {
              return {
                guestItems: state.guestItems.map(
                  (item) =>
                    item.id === product.id
                      ? {
                        ...item,
                        quantity:
                          item.quantity + quantity,
                      }
                      : item
                ),
              }
            }

            return {
              guestItems: [
                ...state.guestItems,
                {
                  ...product,
                  quantity,
                },
              ],
            }
          })

          return
        }

        /*
         * Authenticated user.
         *
         * Optimistically update local state.
         */
        const previousItems = get().items

        set((state) => {
          const existing = state.items.find(
            (item) => item.id === product.id
          )

          if (existing) {
            return {
              items: state.items.map(
                (item) =>
                  item.id === product.id
                    ? {
                      ...item,
                      quantity:
                        item.quantity + quantity,
                    }
                    : item
              ),
            }
          }

          return {
            items: [
              ...state.items,
              {
                ...product,
                quantity,
              },
            ],
          }
        })

        try {
          const response = await fetch(
            '/api/cart',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                productId: product.id,
                quantity,
              }),
            }
          )

          if (!response.ok) {
            throw new Error(
              await getErrorMessage(response)
            )
          }

          /*
           * Server returns the actual CartItem.
           *
           * This gives us the database CartItem.id.
           */
          const serverCartItem =
            await response.json()

          const mappedItem =
            mapServerCartItem(serverCartItem)

          set((state) => {
            const exists = state.items.some(
              (item) =>
                item.id === mappedItem.id
            )

            if (!exists) {
              return {
                items: [
                  ...state.items,
                  mappedItem,
                ],
              }
            }

            return {
              items: state.items.map((item) =>
                item.id === mappedItem.id
                  ? mappedItem
                  : item
              ),
            }
          })
        } catch (error) {
          console.error(
            'Error adding cart item:',
            error
          )

          // Rollback
          set({
            items: previousItems,
          })

          throw error
        }
      },

      /**
       * Remove ONE product.
       *
       * Guest:
       *   local only
       *
       * Authenticated:
       *   DELETE /api/cart/:cartItemId
       */
      removeItem: async (productId) => {
        const isLoggedIn = get().isLoggedIn

        if (!isLoggedIn) {
          set((state) => ({
            guestItems:
              state.guestItems.filter(
                (item) =>
                  item.id !== productId
              ),
          }))

          return
        }

        const currentItem = get().items.find(
          (item) => item.id === productId
        )

        if (!currentItem) {
          return
        }

        /*
         * An authenticated database item must have
         * a CartItem ID.
         */
        if (!currentItem.cartItemId) {
          console.error(
            'Cannot remove authenticated cart item: cartItemId is missing',
            currentItem
          )

          throw new Error(
            'Cart item ID is missing'
          )
        }

        const previousItems = get().items

        // Optimistic removal
        set((state) => ({
          items: state.items.filter(
            (item) => item.id !== productId
          ),
        }))

        try {
          const response = await fetch(
            `/api/cart/${currentItem.cartItemId}`,
            {
              method: 'DELETE',
            }
          )

          if (!response.ok) {
            throw new Error(
              await getErrorMessage(response)
            )
          }
        } catch (error) {
          console.error(
            'Error removing cart item:',
            error
          )

          // Rollback
          set({
            items: previousItems,
          })

          throw error
        }
      },

      /**
       * Update quantity.
       *
       * Guest:
       *   local only
       *
       * Authenticated:
       *   PATCH /api/cart/:cartItemId
       */
      updateQuantity: async (
        productId,
        quantity
      ) => {
        if (
          !Number.isInteger(quantity) ||
          quantity < 1
        ) {
          throw new Error(
            'Quantity must be a positive integer'
          )
        }

        const isLoggedIn = get().isLoggedIn

        if (!isLoggedIn) {
          set((state) => ({
            guestItems:
              state.guestItems.map((item) =>
                item.id === productId
                  ? {
                    ...item,
                    quantity,
                  }
                  : item
              ),
          }))

          return
        }

        const currentItem = get().items.find(
          (item) => item.id === productId
        )

        if (!currentItem) {
          return
        }

        if (!currentItem.cartItemId) {
          console.error(
            'Cannot update authenticated cart item: cartItemId is missing',
            currentItem
          )

          throw new Error(
            'Cart item ID is missing'
          )
        }

        const previousItems = get().items

        // Optimistic update
        set((state) => ({
          items: state.items.map((item) =>
            item.id === productId
              ? {
                ...item,
                quantity,
              }
              : item
          ),
        }))

        try {
          const response = await fetch(
            `/api/cart/${currentItem.cartItemId}`,
            {
              method: 'PATCH',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body: JSON.stringify({
                quantity,
              }),
            }
          )

          if (!response.ok) {
            throw new Error(
              await getErrorMessage(response)
            )
          }

          const serverCartItem =
            await response.json()

          const mappedItem =
            mapServerCartItem(serverCartItem)

          set((state) => ({
            items: state.items.map((item) =>
              item.id === mappedItem.id
                ? mappedItem
                : item
            ),
          }))
        } catch (error) {
          console.error(
            'Error updating cart quantity:',
            error
          )

          // Rollback
          set({
            items: previousItems,
          })

          throw error
        }
      },

      /**
       * Clear entire cart.
       */
      clearCart: async () => {
        const isLoggedIn = get().isLoggedIn

        if (!isLoggedIn) {
          set({
            guestItems: [],
          })

          return
        }

        const previousItems = get().items

        // Optimistic clear
        set({
          items: [],
        })

        try {
          const response = await fetch(
            '/api/cart',
            {
              method: 'DELETE',
            }
          )

          if (!response.ok) {
            throw new Error(
              await getErrorMessage(response)
            )
          }
        } catch (error) {
          console.error(
            'Error clearing cart:',
            error
          )

          // Rollback
          set({
            items: previousItems,
          })

          throw error
        }
      },

      /**
       * Clear authenticated local cart state
       * without touching the server.
       *
       * Used during logout/session changes.
       */
      clearLocalCart: () => {
        set({
          items: [],
          isLoggedIn: false,
        })
      },

      /**
       * Get authenticated cart from server.
       */
      syncWithServer: async () => {
        const isLoggedIn = get().isLoggedIn

        if (!isLoggedIn) {
          return
        }

        set({
          isLoading: true,
        })

        try {
          const response = await fetch(
            '/api/cart',
            {
              method: 'GET',
              cache: 'no-store',
            }
          )

          if (!response.ok) {
            throw new Error(
              await getErrorMessage(response)
            )
          }

          const serverCart =
            await response.json()

          const items = Array.isArray(serverCart)
            ? serverCart.map(mapServerCartItem)
            : []

          set({
            items,
          })
        } catch (error) {
          console.error(
            'Error syncing cart:',
            error
          )

          throw error
        } finally {
          set({
            isLoading: false,
          })
        }
      },

      /**
       * Merge guest cart into authenticated
       * user's server cart.
       */
      mergeCartOnLogin: async (userId) => {
        /*
         * Take a snapshot.
         *
         * This prevents the guest cart from changing underneath
         * the merge operation.
         */
        const guestItems = [...get().guestItems]

        set({
          isLoggedIn: true,
          isLoading: true,
        })

        try {
          console.log(
            '[Cart] Starting login cart merge:',
            userId
          )

          console.log(
            '[Cart] Guest cart:',
            guestItems
          )

          /*
           * ----------------------------------------------------------
           * NO GUEST ITEMS
           * ----------------------------------------------------------
           *
           * User already has a server cart.
           *
           * Just load it.
           */
          if (guestItems.length === 0) {
            await get().syncWithServer()

            console.log(
              '[Cart] No guest items. Server cart loaded.'
            )

            return
          }

          /*
           * ----------------------------------------------------------
           * MERGE GUEST CART
           * ----------------------------------------------------------
           *
           * IMPORTANT:
           *
           * POST /api/cart is ADDITIVE.
           *
           * Example:
           *
           * Server:
           * A1 × 1
           *
           * Guest:
           * A1 × 2
           *
           * POST:
           * quantity = 2
           *
           * Final:
           * A1 × 3
           * ----------------------------------------------------------
           */
          for (const item of guestItems) {
            console.log(
              '[Cart] Merging:',
              {
                productId: item.id,
                quantity: item.quantity,
              }
            )

            const response = await fetch(
              '/api/cart',
              {
                method: 'POST',

                headers: {
                  'Content-Type':
                    'application/json',
                },

                body: JSON.stringify({
                  productId: item.id,
                  quantity: item.quantity,
                }),
              }
            )

            if (!response.ok) {
              throw new Error(
                await getErrorMessage(response)
              )
            }
          }

          /*
           * ----------------------------------------------------------
           * LOAD FINAL SERVER CART
           * ----------------------------------------------------------
           *
           * This makes the server the source of truth.
           */
          await get().syncWithServer()

          /*
           * ----------------------------------------------------------
           * CLEAR GUEST CART
           * ----------------------------------------------------------
           *
           * Only after:
           *
           * 1. Every POST succeeded
           * 2. Server cart was successfully loaded
           */
          set({
            guestItems: [],
          })

          console.log(
            '[Cart] Guest cart merged successfully.'
          )
        } catch (error) {
          /*
           * ----------------------------------------------------------
           * MERGE FAILED
           * ----------------------------------------------------------
           *
           * IMPORTANT:
           *
           * Do NOT clear guestItems.
           *
           * This preserves the user's cart.
           */
          console.error(
            '[Cart] Guest cart merge failed:',
            error
          )

          throw error
        } finally {
          set({
            isLoading: false,
          })
        }
      },

      getTotal: () => {
        const state = get()

        const items = state.isLoggedIn
          ? state.items
          : state.guestItems

        return items.reduce(
          (total, item) =>
            total +
            Number(item.price || 0) *
            item.quantity,
          0
        )
      },

      getTotalItems: () => {
        const state = get()

        const items = state.isLoggedIn
          ? state.items
          : state.guestItems

        return items.reduce(
          (total, item) =>
            total + item.quantity,
          0
        )
      },
    }),

    {
      name: 'cart-storage',

      /**
       * VERY IMPORTANT:
       *
       * Only guest cart is persisted.
       *
       * Authenticated server cart must NOT be
       * persisted into localStorage.
       */
      partialize: (state) => ({
        guestItems: state.guestItems,
      }),
    }
  )
)

export default useCartStore