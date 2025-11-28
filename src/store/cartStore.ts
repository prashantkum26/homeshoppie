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

        // Auto-save to server
        try {
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
            
            if (response.status !== 401) {
              toast.error(error.error || 'Failed to add item to cart')
            }
          }
        } catch (error) {
          console.error('Error syncing cart with server:', error)
        }
      },
      
      removeItem: async (productId: string) => {
        const items = get().items
        const originalItems = [...items]
        
        // Optimistic update
        set({
          items: items.filter(item => item.id !== productId)
        })

        // Auto-save to server
        try {
          const cartItem = originalItems.find(item => item.id === productId)
          if (cartItem) {
            const response = await fetch(`/api/cart/${cartItem.id}`, {
              method: 'DELETE',
            })

            if (!response.ok && response.status !== 401) {
              // Revert on error (except auth errors)
              set({ items: originalItems })
              const error = await response.json()
              toast.error(error.error || 'Failed to remove item from cart')
            }
          }
        } catch (error) {
          console.error('Error syncing cart with server:', error)
          // Revert on network error
          set({ items: originalItems })
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

        // Auto-save to server
        try {
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
        } catch (error) {
          console.error('Error syncing cart with server:', error)
          // Revert on network error
          set({ items: originalItems })
        }
      },
      
      clearCart: async () => {
        const originalItems = [...get().items]
        
        // Optimistic update
        set({ items: [] })

        // Auto-save to server
        try {
          const response = await fetch('/api/cart', {
            method: 'DELETE',
          })

          if (!response.ok && response.status !== 401) {
            // Revert on error (except auth errors)
            set({ items: originalItems })
            const error = await response.json()
            toast.error(error.error || 'Failed to clear cart')
          }
        } catch (error) {
          console.error('Error syncing cart with server:', error)
          // Revert on network error
          set({ items: originalItems })
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
