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

// These tests exercise the guest cart (isLoggedIn: false), which is
// synchronous and local-only, so no network mocking is required.
describe('useCartStore (guest cart)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset store state before each test (without replacing actions)
    useCartStore.setState({
      items: [],
      guestItems: [],
      isLoggedIn: false,
    })
  })

  const mockProduct: Product = {
    id: '1',
    slug: 'test-product',
    name: 'Test Product',
    description: 'Test Description',
    price: 100,
    compareAtPrice: 120,
    stock: 10,
    images: ['image1.jpg'],
    categoryId: 'cat1',
    isActive: true,
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockProduct2: Product = {
    id: '2',
    slug: 'test-product-2',
    name: 'Test Product 2',
    description: 'Test Description 2',
    price: 200,
    compareAtPrice: 250,
    stock: 5,
    images: ['image2.jpg'],
    categoryId: 'cat1',
    isActive: true,
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  describe('addItem', () => {
    it('should add new item to the guest cart', async () => {
      const { result } = renderHook(() => useCartStore())

      await act(async () => {
        await result.current.addItem(mockProduct)
      })

      expect(result.current.guestItems).toHaveLength(1)
      expect(result.current.guestItems[0]).toEqual({
        ...mockProduct,
        quantity: 1,
      })
    })

    it('should increment quantity for existing item', async () => {
      const { result } = renderHook(() => useCartStore())

      await act(async () => {
        await result.current.addItem(mockProduct)
        await result.current.addItem(mockProduct)
      })

      expect(result.current.guestItems).toHaveLength(1)
      expect(result.current.guestItems[0].quantity).toBe(2)
    })

    it('should add multiple different products', async () => {
      const { result } = renderHook(() => useCartStore())

      await act(async () => {
        await result.current.addItem(mockProduct)
        await result.current.addItem(mockProduct2)
      })

      expect(result.current.guestItems).toHaveLength(2)
      expect(result.current.guestItems[0].id).toBe('1')
      expect(result.current.guestItems[1].id).toBe('2')
    })

    it('should reject a non-positive-integer quantity', async () => {
      const { result } = renderHook(() => useCartStore())

      await expect(
        result.current.addItem(mockProduct, 0)
      ).rejects.toThrow('Quantity must be a positive integer')
    })
  })

  describe('removeItem', () => {
    it('should remove item from the guest cart', async () => {
      const { result } = renderHook(() => useCartStore())

      await act(async () => {
        await result.current.addItem(mockProduct)
        await result.current.addItem(mockProduct2)
      })

      expect(result.current.guestItems).toHaveLength(2)

      await act(async () => {
        await result.current.removeItem('1')
      })

      expect(result.current.guestItems).toHaveLength(1)
      expect(result.current.guestItems[0].id).toBe('2')
    })

    it('should handle removing a non-existent item', async () => {
      const { result } = renderHook(() => useCartStore())

      await act(async () => {
        await result.current.addItem(mockProduct)
      })

      await act(async () => {
        await result.current.removeItem('nonexistent')
      })

      expect(result.current.guestItems).toHaveLength(1)
    })
  })

  describe('updateQuantity', () => {
    it('should update item quantity', async () => {
      const { result } = renderHook(() => useCartStore())

      await act(async () => {
        await result.current.addItem(mockProduct)
        await result.current.updateQuantity('1', 5)
      })

      expect(result.current.guestItems[0].quantity).toBe(5)
    })

    it('should reject a non-positive-integer quantity', async () => {
      const { result } = renderHook(() => useCartStore())

      await act(async () => {
        await result.current.addItem(mockProduct)
      })

      await expect(
        result.current.updateQuantity('1', 0)
      ).rejects.toThrow('Quantity must be a positive integer')
    })

    it('should handle updating a non-existent item', async () => {
      const { result } = renderHook(() => useCartStore())

      await act(async () => {
        await result.current.addItem(mockProduct)
        await result.current.updateQuantity('nonexistent', 5)
      })

      expect(result.current.guestItems).toHaveLength(1)
      expect(result.current.guestItems[0].quantity).toBe(1)
    })
  })

  describe('clearCart', () => {
    it('should clear all items from the guest cart', async () => {
      const { result } = renderHook(() => useCartStore())

      await act(async () => {
        await result.current.addItem(mockProduct)
        await result.current.addItem(mockProduct2)
      })

      expect(result.current.guestItems).toHaveLength(2)

      await act(async () => {
        await result.current.clearCart()
      })

      expect(result.current.guestItems).toHaveLength(0)
    })
  })

  describe('getTotal', () => {
    it('should calculate total price correctly', async () => {
      const { result } = renderHook(() => useCartStore())

      await act(async () => {
        await result.current.addItem(mockProduct) // 100 * 1 = 100
        await result.current.addItem(mockProduct2) // 200 * 1 = 200
        await result.current.updateQuantity('1', 2) // 100 * 2 = 200
      })

      expect(result.current.getTotal()).toBe(400) // 200 + 200
    })

    it('should return 0 for an empty cart', () => {
      const { result } = renderHook(() => useCartStore())

      expect(result.current.getTotal()).toBe(0)
    })
  })

  describe('getTotalItems', () => {
    it('should calculate total items correctly', async () => {
      const { result } = renderHook(() => useCartStore())

      await act(async () => {
        await result.current.addItem(mockProduct)
        await result.current.addItem(mockProduct2)
        await result.current.updateQuantity('1', 3)
      })

      expect(result.current.getTotalItems()).toBe(4) // 3 + 1
    })

    it('should return 0 for an empty cart', () => {
      const { result } = renderHook(() => useCartStore())

      expect(result.current.getTotalItems()).toBe(0)
    })
  })
})
