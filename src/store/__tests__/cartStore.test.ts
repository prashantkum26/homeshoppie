import { act, renderHook } from '@testing-library/react'
import useCartStore from '../cartStore'
import type { Product } from '@/types'

// Mock zustand persist to avoid localStorage issues in tests
jest.mock('zustand/middleware', () => ({
  persist: (config: any) => config,
}))

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('useCartStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset store state before each test
    useCartStore.setState({ items: [] }, true)
  })

  const mockProduct: Product = {
    id: '1',
    slug: 'test-product',
    name: 'Test Product',
    description: 'Test Description',
    price: 100,
    originalPrice: 120,
    stock: 10,
    sku: 'TEST001',
    images: ['image1.jpg'],
    categoryId: 'cat1',
    featured: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockProduct2: Product = {
    id: '2',
    slug: 'test-product-2',
    name: 'Test Product 2',
    description: 'Test Description 2',
    price: 200,
    originalPrice: 250,
    stock: 5,
    sku: 'TEST002',
    images: ['image2.jpg'],
    categoryId: 'cat1',
    featured: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  describe('addItem', () => {
    it('should add new item to cart', () => {
      const { result } = renderHook(() => useCartStore())

      act(() => {
        result.current.addItem(mockProduct)
      })

      expect(result.current.items).toHaveLength(1)
      expect(result.current.items[0]).toEqual({
        ...mockProduct,
        quantity: 1,
      })
    })

    it('should increment quantity for existing item', () => {
      const { result } = renderHook(() => useCartStore())

      act(() => {
        result.current.addItem(mockProduct)
        result.current.addItem(mockProduct)
      })

      expect(result.current.items).toHaveLength(1)
      expect(result.current.items[0].quantity).toBe(2)
    })

    it('should add multiple different products', () => {
      const { result } = renderHook(() => useCartStore())

      act(() => {
        result.current.addItem(mockProduct)
        result.current.addItem(mockProduct2)
      })

      expect(result.current.items).toHaveLength(2)
      expect(result.current.items[0].id).toBe('1')
      expect(result.current.items[1].id).toBe('2')
    })
  })

  describe('removeItem', () => {
    it('should remove item from cart', () => {
      const { result } = renderHook(() => useCartStore())

      act(() => {
        result.current.addItem(mockProduct)
        result.current.addItem(mockProduct2)
      })

      expect(result.current.items).toHaveLength(2)

      act(() => {
        result.current.removeItem('1')
      })

      expect(result.current.items).toHaveLength(1)
      expect(result.current.items[0].id).toBe('2')
    })

    it('should handle removing non-existent item', () => {
      const { result } = renderHook(() => useCartStore())

      act(() => {
        result.current.addItem(mockProduct)
      })

      expect(result.current.items).toHaveLength(1)

      act(() => {
        result.current.removeItem('nonexistent')
      })

      expect(result.current.items).toHaveLength(1)
    })
  })

  describe('updateQuantity', () => {
    it('should update item quantity', () => {
      const { result } = renderHook(() => useCartStore())

      act(() => {
        result.current.addItem(mockProduct)
      })

      act(() => {
        result.current.updateQuantity('1', 5)
      })

      expect(result.current.items[0].quantity).toBe(5)
    })

    it('should remove item when quantity is 0', () => {
      const { result } = renderHook(() => useCartStore())

      act(() => {
        result.current.addItem(mockProduct)
      })

      act(() => {
        result.current.updateQuantity('1', 0)
      })

      expect(result.current.items).toHaveLength(0)
    })

    it('should remove item when quantity is negative', () => {
      const { result } = renderHook(() => useCartStore())

      act(() => {
        result.current.addItem(mockProduct)
      })

      act(() => {
        result.current.updateQuantity('1', -1)
      })

      expect(result.current.items).toHaveLength(0)
    })

    it('should handle updating non-existent item', () => {
      const { result } = renderHook(() => useCartStore())

      act(() => {
        result.current.addItem(mockProduct)
      })

      act(() => {
        result.current.updateQuantity('nonexistent', 5)
      })

      expect(result.current.items).toHaveLength(1)
      expect(result.current.items[0].quantity).toBe(1)
    })
  })

  describe('clearCart', () => {
    it('should clear all items from cart', () => {
      const { result } = renderHook(() => useCartStore())

      act(() => {
        result.current.addItem(mockProduct)
        result.current.addItem(mockProduct2)
      })

      expect(result.current.items).toHaveLength(2)

      act(() => {
        result.current.clearCart()
      })

      expect(result.current.items).toHaveLength(0)
    })
  })

  describe('getTotal', () => {
    it('should calculate total price correctly', () => {
      const { result } = renderHook(() => useCartStore())

      act(() => {
        result.current.addItem(mockProduct) // 100 * 1 = 100
        result.current.addItem(mockProduct2) // 200 * 1 = 200
        result.current.updateQuantity('1', 2) // 100 * 2 = 200
      })

      expect(result.current.getTotal()).toBe(400) // 200 + 200
    })

    it('should return 0 for empty cart', () => {
      const { result } = renderHook(() => useCartStore())

      expect(result.current.getTotal()).toBe(0)
    })
  })

  describe('getTotalItems', () => {
    it('should calculate total items correctly', () => {
      const { result } = renderHook(() => useCartStore())

      act(() => {
        result.current.addItem(mockProduct)
        result.current.addItem(mockProduct2)
        result.current.updateQuantity('1', 3)
      })

      expect(result.current.getTotalItems()).toBe(4) // 3 + 1
    })

    it('should return 0 for empty cart', () => {
      const { result } = renderHook(() => useCartStore())

      expect(result.current.getTotalItems()).toBe(0)
    })
  })

  describe('persistence', () => {
    it('should persist cart state to localStorage', () => {
      const { result } = renderHook(() => useCartStore())

      act(() => {
        result.current.addItem(mockProduct)
      })

      // Zustand persist middleware should save to localStorage
      expect(localStorageMock.setItem).toHaveBeenCalled()
    })
  })
})
