import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface WishlistItem {
  id: string
  name: string
  price: number
  images?: string[]
  category?: string
}

interface WishlistStore {
  items: WishlistItem[]
  isLoading: boolean
  
  // Actions
  addToWishlist: (item: WishlistItem) => void
  removeFromWishlist: (productId: string) => void
  clearWishlist: () => void
  isInWishlist: (productId: string) => boolean
  getWishlistCount: () => number
  
  // Sync with server (for logged-in users)
  syncWithServer: () => Promise<void>
  fetchFromServer: () => Promise<void>
}

const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,

      addToWishlist: (item: WishlistItem) => {
        const { items } = get()
        const existingItem = items.find(i => i.id === item.id)
        
        if (!existingItem) {
          const newItems = [...items, item]
          set({ items: newItems })
          
          // Sync with server if user is logged in
          get().syncWithServer()
        }
      },

      removeFromWishlist: (productId: string) => {
        const { items } = get()
        const newItems = items.filter(item => item.id !== productId)
        set({ items: newItems })
        
        // Sync with server if user is logged in
        get().syncWithServer()
      },

      clearWishlist: () => {
        set({ items: [] })
      },

      isInWishlist: (productId: string) => {
        const { items } = get()
        return items.some(item => item.id === productId)
      },

      getWishlistCount: () => {
        const { items } = get()
        return items.length
      },

      syncWithServer: async () => {
        try {
          // Check if user is logged in
          const sessionResponse = await fetch('/api/auth/session')
          const session = await sessionResponse.json()
          
          if (session?.user?.id) {
            const { items } = get()
            
            // Sync local wishlist to server
            await fetch('/api/user/wishlist/sync', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ items }),
            })
          }
        } catch (error) {
          console.error('Failed to sync wishlist with server:', error)
        }
      },

      fetchFromServer: async () => {
        try {
          set({ isLoading: true })
          
          const response = await fetch('/api/user/wishlist')
          if (response.ok) {
            const serverItems = await response.json()
            
            // Merge server items with local items, server takes precedence
            const { items: localItems } = get()
            const mergedItems = [...serverItems]
            
            // Add any local items that aren't on server
            localItems.forEach(localItem => {
              if (!serverItems.find((serverItem: WishlistItem) => serverItem.id === localItem.id)) {
                mergedItems.push(localItem)
              }
            })
            
            set({ items: mergedItems })
            
            // Sync the merged list back to server
            if (mergedItems.length > serverItems.length) {
              await get().syncWithServer()
            }
          }
        } catch (error) {
          console.error('Failed to fetch wishlist from server:', error)
        } finally {
          set({ isLoading: false })
        }
      },
    }),
    {
      name: 'wishlist-storage',
      partialize: (state) => ({ items: state.items }),
    }
  )
)

export default useWishlistStore
