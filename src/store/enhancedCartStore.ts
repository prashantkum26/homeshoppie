import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  images?: string[]
  selected?: boolean // For selective checkout
}

interface SavedForLaterItem {
  id: string
  name: string
  price: number
  quantity: number
  images?: string[]
}

interface EnhancedCartStore {
  cartItems: CartItem[]
  savedForLater: SavedForLaterItem[]
  isLoading: boolean

  // Cart actions
  addToCart: (item: Omit<CartItem, 'selected'>) => void
  removeFromCart: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  
  // Selection actions
  toggleItemSelection: (productId: string) => void
  selectAllItems: (selected: boolean) => void
  getSelectedItems: () => CartItem[]
  getSelectedTotal: () => number
  getSelectedCount: () => number
  
  // Save for later actions
  saveForLater: (productId: string) => void
  moveToCart: (productId: string) => void
  removeSavedItem: (productId: string) => void
  clearSavedItems: () => void
  
  // Helper functions
  getTotalItems: () => number
  getTotal: () => number
  isInCart: (productId: string) => boolean
  
  // Sync functions
  syncWithServer: () => Promise<void>
  fetchFromServer: () => Promise<void>
}

const useEnhancedCartStore = create<EnhancedCartStore>()(
  persist(
    (set, get) => ({
      cartItems: [],
      savedForLater: [],
      isLoading: false,

      addToCart: (item: Omit<CartItem, 'selected'>) => {
        const { cartItems } = get()
        const existingItem = cartItems.find(i => i.id === item.id)
        
        if (existingItem) {
          // Update quantity
          const updatedItems = cartItems.map(i =>
            i.id === item.id 
              ? { ...i, quantity: i.quantity + item.quantity, selected: true }
              : i
          )
          set({ cartItems: updatedItems })
        } else {
          // Add new item (selected by default)
          set({ 
            cartItems: [...cartItems, { ...item, selected: true }] 
          })
        }
        
        // Also remove from saved for later if it exists there
        const { savedForLater } = get()
        const updatedSaved = savedForLater.filter(i => i.id !== item.id)
        set({ savedForLater: updatedSaved })
        
        get().syncWithServer()
      },

      removeFromCart: (productId: string) => {
        const { cartItems } = get()
        const updatedItems = cartItems.filter(item => item.id !== productId)
        set({ cartItems: updatedItems })
        get().syncWithServer()
      },

      updateQuantity: (productId: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeFromCart(productId)
          return
        }
        
        const { cartItems } = get()
        const updatedItems = cartItems.map(item =>
          item.id === productId ? { ...item, quantity } : item
        )
        set({ cartItems: updatedItems })
        get().syncWithServer()
      },

      clearCart: () => {
        set({ cartItems: [] })
      },

      toggleItemSelection: (productId: string) => {
        const { cartItems } = get()
        const updatedItems = cartItems.map(item =>
          item.id === productId 
            ? { ...item, selected: !item.selected }
            : item
        )
        set({ cartItems: updatedItems })
      },

      selectAllItems: (selected: boolean) => {
        const { cartItems } = get()
        const updatedItems = cartItems.map(item => ({ ...item, selected }))
        set({ cartItems: updatedItems })
      },

      getSelectedItems: () => {
        const { cartItems } = get()
        return cartItems.filter(item => item.selected)
      },

      getSelectedTotal: () => {
        const selectedItems = get().getSelectedItems()
        return selectedItems.reduce((total, item) => total + (item.price * item.quantity), 0)
      },

      getSelectedCount: () => {
        const selectedItems = get().getSelectedItems()
        return selectedItems.reduce((count, item) => count + item.quantity, 0)
      },

      saveForLater: (productId: string) => {
        const { cartItems, savedForLater } = get()
        const itemToSave = cartItems.find(item => item.id === productId)
        
        if (itemToSave) {
          const savedItem: SavedForLaterItem = {
            id: itemToSave.id,
            name: itemToSave.name,
            price: itemToSave.price,
            quantity: itemToSave.quantity,
            images: itemToSave.images
          }
          
          // Remove from cart and add to saved
          const updatedCartItems = cartItems.filter(item => item.id !== productId)
          const updatedSaved = savedForLater.filter(item => item.id !== productId)
          
          set({ 
            cartItems: updatedCartItems,
            savedForLater: [...updatedSaved, savedItem]
          })
          
          get().syncWithServer()
        }
      },

      moveToCart: (productId: string) => {
        const { savedForLater } = get()
        const itemToMove = savedForLater.find(item => item.id === productId)
        
        if (itemToMove) {
          get().addToCart(itemToMove)
          get().removeSavedItem(productId)
        }
      },

      removeSavedItem: (productId: string) => {
        const { savedForLater } = get()
        const updatedSaved = savedForLater.filter(item => item.id !== productId)
        set({ savedForLater: updatedSaved })
        get().syncWithServer()
      },

      clearSavedItems: () => {
        set({ savedForLater: [] })
      },

      getTotalItems: () => {
        const { cartItems } = get()
        return cartItems.reduce((total, item) => total + item.quantity, 0)
      },

      getTotal: () => {
        const { cartItems } = get()
        return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0)
      },

      isInCart: (productId: string) => {
        const { cartItems } = get()
        return cartItems.some(item => item.id === productId)
      },

      syncWithServer: async () => {
        try {
          const sessionResponse = await fetch('/api/auth/session')
          const session = await sessionResponse.json()
          
          if (session?.user?.id) {
            const { cartItems, savedForLater } = get()
            
            await fetch('/api/cart/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cartItems, savedForLater }),
            })
          }
        } catch (error) {
          console.error('Failed to sync cart with server:', error)
        }
      },

      fetchFromServer: async () => {
        try {
          set({ isLoading: true })
          
          const [cartResponse, savedResponse] = await Promise.all([
            fetch('/api/cart'),
            fetch('/api/cart/saved')
          ])
          
          if (cartResponse.ok && savedResponse.ok) {
            const [serverCart, serverSaved] = await Promise.all([
              cartResponse.json(),
              savedResponse.json()
            ])
            
            // Merge with local data, server takes precedence
            set({ 
              cartItems: serverCart.map((item: any) => ({ ...item, selected: true })),
              savedForLater: serverSaved
            })
          }
        } catch (error) {
          console.error('Failed to fetch cart from server:', error)
        } finally {
          set({ isLoading: false })
        }
      },
    }),
    {
      name: 'enhanced-cart-storage',
      partialize: (state) => ({ 
        cartItems: state.cartItems,
        savedForLater: state.savedForLater
      }),
    }
  )
)

export default useEnhancedCartStore
