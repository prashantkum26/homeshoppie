import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product } from '@/types'
import toast from 'react-hot-toast'

interface CartItem extends Product {
  quantity: number
}

interface CartStore {
  items: CartItem[]
  isLoading: boolean
  addItem: (product: Product) => Promise<void>
  removeItem: (productId: string) => Promise<void>
  updateQuantity: (productId: string, quantity: number) => Promise<void>
  clearCart: () => Promise<void>
  syncWithServer: () => Promise<void>
  getTotal: () => number
  getTotalItems: () => number
}

const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,
      
      addItem: async (product: Product) => {
        const items = get().items
        const existingItem = items.find(item => item.id === product.id)
        
        // Optimistic update
        if (existingItem) {
          set({
            items: items.map(item =>
              item.id === product.id
                ? { ...item, quantity: item.quantity + 1 }
                : item
            )
          })
        } else {
          set({
            items: [...items, { ...product, quantity: 1 }]
          })
        }

        // Auto-save to server only if user is authenticated
        try {
          // Check if user is authenticated
          const authCheckResponse = await fetch('/api/auth/session')
          
          if (authCheckResponse.ok) {
            const session = await authCheckResponse.json()
            
            if (session?.user) {
              // User is authenticated, sync with server
              const response = await fetch('/api/cart', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  productId: product.id,
                  quantity: 1,
                }),
              })

              if (!response.ok) {
                const error = await response.json()
                // Revert optimistic update on error
                if (existingItem) {
                  set({
                    items: items.map(item =>
                      item.id === product.id
                        ? { ...item, quantity: item.quantity }
                        : item
                    )
                  })
                } else {
                  set({
                    items: items.filter(item => item.id !== product.id)
                  })
                }
                
                toast.error(error.error || 'Failed to add item to cart')
              }
            }
            // If user is not authenticated, just keep local changes
          }
        } catch (error) {
          console.error('Error syncing cart with server:', error)
          // For unauthenticated users, don't revert - keep local changes
        }
      },
      
      removeItem: async (productId: string) => {
        const items = get().items
        const originalItems = [...items]
        
        // Optimistic update
        set({
          items: items.filter(item => item.id !== productId)
        })

        // Auto-save to server only if user is authenticated
        try {
          // Check if user is authenticated
          const authCheckResponse = await fetch('/api/auth/session')
          
          if (authCheckResponse.ok) {
            const session = await authCheckResponse.json()
            
            if (session?.user) {
              // User is authenticated, try to sync with server
              const cartItem = originalItems.find(item => item.id === productId)
              if (cartItem) {
                const response = await fetch(`/api/cart/${cartItem.id}`, {
                  method: 'DELETE',
                })

                if (!response.ok) {
                  // Revert on error
                  set({ items: originalItems })
                  const error = await response.json()
                  toast.error(error.error || 'Failed to remove item from cart')
                }
              }
            }
            // If user is not authenticated, just keep local changes
          }
        } catch (error) {
          console.error('Error syncing cart with server:', error)
          // For unauthenticated users, don't revert - keep local changes
        }
      },
      
      updateQuantity: async (productId: string, quantity: number) => {
        if (quantity <= 0) {
          await get().removeItem(productId)
          return
        }

        const items = get().items
        const originalItems = [...items]
        
        // Optimistic update
        set({
          items: items.map(item =>
            item.id === productId
              ? { ...item, quantity }
              : item
          )
        })

        // Auto-save to server only if user is authenticated
        try {
          // Check if user is authenticated by making a simple request first
          const authCheckResponse = await fetch('/api/auth/session')
          
          if (authCheckResponse.ok) {
            const session = await authCheckResponse.json()
            
            if (session?.user) {
              // User is authenticated, try to sync with server
              const cartItem = items.find(item => item.id === productId)
              if (cartItem) {
                const response = await fetch(`/api/cart/${cartItem.id}`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ quantity }),
                })

                if (!response.ok && response.status !== 401) {
                  // Revert on error (except auth errors)
                  set({ items: originalItems })
                  const error = await response.json()
                  toast.error(error.error || 'Failed to update cart')
                }
              }
            }
            // If user is not authenticated, just keep local changes without API call
          }
        } catch (error) {
          console.error('Error syncing cart with server:', error)
          // For unauthenticated users, don't revert - keep local changes
          // Only revert if we know the user was authenticated and the API call failed
        }
      },
      
      clearCart: async () => {
        const originalItems = [...get().items]
        
        // Optimistic update
        set({ items: [] })

        // Auto-save to server only if user is authenticated
        try {
          // Check if user is authenticated
          const authCheckResponse = await fetch('/api/auth/session')
          
          if (authCheckResponse.ok) {
            const session = await authCheckResponse.json()
            
            if (session?.user) {
              // User is authenticated, sync with server
              const response = await fetch('/api/cart', {
                method: 'DELETE',
              })

              if (!response.ok) {
                // Revert on error
                set({ items: originalItems })
                const error = await response.json()
                toast.error(error.error || 'Failed to clear cart')
              }
            }
            // If user is not authenticated, just keep local changes
          }
        } catch (error) {
          console.error('Error syncing cart with server:', error)
          // For unauthenticated users, don't revert - keep local changes
        }
      },

      syncWithServer: async () => {
        try {
          set({ isLoading: true })
          
          const response = await fetch('/api/cart')
          
          if (response.ok) {
            const serverCartItems = await response.json()
            
            // Transform server cart items to match our store format
            const transformedItems = serverCartItems.map((item: any) => ({
              ...item.product,
              quantity: item.quantity
            }))
            
            set({ items: transformedItems })
          } else if (response.status === 401) {
            // User not logged in, keep local cart
            console.log('User not authenticated, using local cart')
          }
        } catch (error) {
          console.error('Error syncing cart with server:', error)
        } finally {
          set({ isLoading: false })
        }
      },
      
      getTotal: () => {
        return get().items.reduce((total, item) => {
          return total + (item.price * item.quantity)
        }, 0)
      },
      
      getTotalItems: () => {
        return get().items.reduce((total, item) => {
          return total + item.quantity
        }, 0)
      }
    }),
    {
      name: 'cart-storage',
    }
  )
)

export default useCartStore
