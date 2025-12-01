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
          const { items } = get()
          
          if (items.length === 0) return
          
          // Sync local wishlist to server
          const response = await fetch('/api/user/wishlist/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ items }),
          })
          
          if (response.ok) {
            const data = await response.json()
            if (data.success && data.wishlist) {
              set({ items: data.wishlist })
            }
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
            const { items: localItems } = get()
            
            // If there are local items but server is empty/different, sync local to server
            if (localItems.length > 0) {
              const syncResponse = await fetch('/api/user/wishlist/sync', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ items: localItems }),
              })
              
              if (syncResponse.ok) {
                const syncData = await syncResponse.json()
                if (syncData.success && syncData.wishlist) {
                  set({ items: syncData.wishlist })
                  return
                }
              }
            }
            
            // If no local items or sync failed, use server items
            set({ items: serverItems })
          } else if (response.status === 401) {
            // User not authenticated, keep local items
            console.log('User not authenticated, keeping local wishlist')
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
