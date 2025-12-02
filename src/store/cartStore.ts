import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product } from '@/types'
import toast from 'react-hot-toast'

interface CartItem extends Product {
  quantity: number
  cartItemId?: string // Database cart item ID for API calls
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
        
        // Simple optimistic update - no automatic server sync
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
      },
      
      removeItem: async (productId: string) => {
        // Simple local update - no automatic server sync
        set({
          items: get().items.filter(item => item.id !== productId)
        })
      },
      
      updateQuantity: async (productId: string, quantity: number) => {
        if (quantity <= 0) {
          await get().removeItem(productId)
          return
        }

        // Simple local update - no automatic server sync
        set({
          items: get().items.map(item =>
            item.id === productId
              ? { ...item, quantity }
              : item
          )
        })
      },
      
      clearCart: async () => {
        // Simple local update - no automatic server sync
        set({ items: [] })
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
              quantity: item.quantity,
              cartItemId: item.id // Store the cart item database ID
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
