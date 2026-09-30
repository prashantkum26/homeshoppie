import { NextRequest } from 'next/server'
import { POST } from '../route'
import { prisma } from '@/lib/prisma'
import { auth, hasVerifiedContact } from '@/lib/auth'
import { isSameOriginRequest } from '@/lib/security'
import { calculateOrderTax } from '@/lib/taxEngine'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    order: { findFirst: jest.fn() },
    product: { findUnique: jest.fn() },
    cartItem: { deleteMany: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
  hasVerifiedContact: jest.fn(),
}))
jest.mock('@/lib/security', () => ({ isSameOriginRequest: jest.fn() }))
jest.mock('@/lib/taxEngine', () => ({ calculateOrderTax: jest.fn() }))

const mockPrisma = prisma as any
const mockAuth = auth as jest.Mock
const mockVerified = hasVerifiedContact as jest.Mock
const mockSameOrigin = isSameOriginRequest as jest.Mock
const mockTax = calculateOrderTax as jest.Mock

const USER_ID = 'user_1'
const PRODUCT_A = 'aaaaaaaaaaaaaaaaaaaaaaaa'

const shippingAddress = {
  name: 'Test User',
  phone: '9999999999',
  street1: '1 Test Road',
  city: 'Pune',
  state: 'Maharashtra',
  postalCode: '411001',
}

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  } as any)
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    items: [{ productId: PRODUCT_A, quantity: 2 }],
    shippingAddress,
    paymentMethod: 'card',
    ...overrides,
  }
}

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: PRODUCT_A,
    name: 'Widget',
    price: 100,
    stock: 10,
    isActive: true,
    category: { name: 'Tools' },
    ...overrides,
  }
}

function buildTx() {
  return {
    address: {
      create: jest.fn().mockResolvedValue({ id: 'addr_1' }),
      findFirst: jest.fn().mockResolvedValue({ id: 'addr_1' }),
    },
    order: {
      create: jest.fn().mockResolvedValue({ id: 'order_1', orderItems: [] }),
    },
    orderItem: { create: jest.fn().mockResolvedValue({}) },
    product: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  }
}

describe('POST /api/orders', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    // Pinned so the suite does not depend on a developer's .env files:
    // gateway-backed payment methods are unavailable without these.
    process.env = {
      ...ORIGINAL_ENV,
      RAZORPAY_KEY_ID: 'rzp_test_key',
      RAZORPAY_KEY_SECRET: 'test_secret',
    }
    delete process.env.PAYMENT_METHODS_DISABLED
    mockSameOrigin.mockReturnValue(true)
    mockAuth.mockResolvedValue({ user: { id: USER_ID } })
    mockVerified.mockResolvedValue(true)
    mockPrisma.order.findFirst.mockResolvedValue(null)
    mockPrisma.product.findUnique.mockResolvedValue(product())
    mockPrisma.cartItem.deleteMany.mockResolvedValue({ count: 0 })
    mockTax.mockResolvedValue({
      finalTotal: 250,
      totalTaxAmount: 0,
      taxBreakdown: [],
    })
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  describe('request authorization', () => {
    it('rejects a cross-origin request', async () => {
      mockSameOrigin.mockReturnValue(false)

      const response = await POST(request(validBody()))

      expect(response.status).toBe(403)
      expect(mockAuth).not.toHaveBeenCalled()
    })

    it('rejects an unauthenticated request', async () => {
      mockAuth.mockResolvedValue(null)

      expect((await POST(request(validBody()))).status).toBe(401)
    })

    it('rejects a user without verified contact details', async () => {
      mockVerified.mockResolvedValue(false)

      const response = await POST(request(validBody()))

      expect(response.status).toBe(403)
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })
  })

  describe('payment method availability', () => {
    it('rejects an enum value that is not currently enabled', async () => {
      const response = await POST(request(validBody({ paymentMethod: 'netbanking' })))
      const payload = await response.json()

      expect(response.status).toBe(409)
      expect(payload.code).toBe('PAYMENT_METHOD_UNAVAILABLE')
      expect(payload.reason).toBe('METHOD_DISABLED')
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it('rejects a method disabled by the env override', async () => {
      process.env.PAYMENT_METHODS_DISABLED = 'card'

      const response = await POST(request(validBody({ paymentMethod: 'card' })))
      const payload = await response.json()

      expect(response.status).toBe(409)
      expect(payload.reason).toBe('METHOD_DISABLED')
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it('rejects every gateway method when Razorpay is unconfigured', async () => {
      delete process.env.RAZORPAY_KEY_ID

      const response = await POST(request(validBody()))
      const payload = await response.json()

      expect(response.status).toBe(409)
      expect(payload.reason).toBe('GATEWAY_UNAVAILABLE')
      expect(payload.availablePaymentMethods).toEqual([])
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it('rejects UPI when the server-computed total exceeds its limit', async () => {
      mockTax.mockResolvedValue({
        finalTotal: 150000,
        totalTaxAmount: 0,
        taxBreakdown: [],
      })

      const response = await POST(request(validBody({ paymentMethod: 'upi' })))
      const payload = await response.json()

      expect(response.status).toBe(409)
      expect(payload.reason).toBe('AMOUNT_ABOVE_MAXIMUM')
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it('offers the remaining valid methods when one is rejected', async () => {
      mockTax.mockResolvedValue({
        finalTotal: 150000,
        totalTaxAmount: 0,
        taxBreakdown: [],
      })

      const response = await POST(request(validBody({ paymentMethod: 'upi' })))
      const payload = await response.json()

      expect(payload.availablePaymentMethods).toEqual([
        expect.objectContaining({ value: 'card' }),
      ])
    })

    it('does not leak gateway configuration in the offered list', async () => {
      delete process.env.PAYMENT_METHODS_DISABLED
      mockTax.mockResolvedValue({
        finalTotal: 150000,
        totalTaxAmount: 0,
        taxBreakdown: [],
      })

      const response = await POST(request(validBody({ paymentMethod: 'upi' })))
      const payload = await response.json()

      expect(payload.availablePaymentMethods[0]).not.toHaveProperty('gatewayMethodRestriction')
      expect(payload.availablePaymentMethods[0]).not.toHaveProperty('maxAmount')
    })

    it('persists the selected method verbatim without defaulting', async () => {
      const tx = buildTx()
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx))

      await POST(request(validBody({ paymentMethod: 'upi' })))

      expect(tx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ paymentMethod: 'upi' }),
        })
      )
    })

    it('checks availability before creating any order row', async () => {
      const tx = buildTx()
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx))

      await POST(request(validBody({ paymentMethod: 'wallet' })))

      expect(tx.order.create).not.toHaveBeenCalled()
      expect(tx.product.updateMany).not.toHaveBeenCalled()
    })
  })

  describe('input validation', () => {
    it.each([
      ['empty items', { items: [] }],
      ['missing items', { items: undefined }],
      ['missing shipping address', { shippingAddress: undefined }],
      ['missing shipping state', { shippingAddress: { ...shippingAddress, state: undefined } }],
      ['invalid payment method', { paymentMethod: 'cash' }],
      ['missing payment method', { paymentMethod: undefined }],
    ])('rejects %s', async (_label, override) => {
      const response = await POST(request(validBody(override)))

      expect(response.status).toBe(400)
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it.each([
      ['a non-integer quantity', 1.5],
      ['a zero quantity', 0],
      ['a negative quantity', -5],
      ['a quantity above the cap', 101],
    ])('rejects %s', async (_label, quantity) => {
      const response = await POST(
        request(validBody({ items: [{ productId: PRODUCT_A, quantity }] }))
      )

      expect(response.status).toBe(400)
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it('rejects a malformed product id', async () => {
      const response = await POST(
        request(validBody({ items: [{ productId: 'not-an-objectid', quantity: 1 }] }))
      )

      expect(response.status).toBe(400)
      expect(mockPrisma.product.findUnique).not.toHaveBeenCalled()
    })

    it('rejects a non-object item entry', async () => {
      const response = await POST(request(validBody({ items: ['nope'] })))

      expect(response.status).toBe(400)
    })
  })

  describe('server-side pricing', () => {
    it('ignores a client-supplied price and uses the database price', async () => {
      const tx = buildTx()
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx))

      await POST(
        request(
          validBody({
            items: [{ productId: PRODUCT_A, quantity: 2, price: 1, unitPrice: 1 }],
          })
        )
      )

      expect(mockTax).toHaveBeenCalledWith(
        expect.objectContaining({ subtotal: 200 })
      )
      expect(tx.orderItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ unitPrice: 100, totalPrice: 200 }),
        })
      )
    })

    it('ignores a client-supplied total and uses the computed tax total', async () => {
      const tx = buildTx()
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx))

      await POST(request(validBody({ totalAmount: 1, subtotalAmount: 1 })))

      expect(tx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ totalAmount: 250, subtotalAmount: 200 }),
        })
      )
    })

    it('aggregates duplicate product entries into a single validated item', async () => {
      const tx = buildTx()
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx))

      await POST(
        request(
          validBody({
            items: [
              { productId: PRODUCT_A, quantity: 2 },
              { productId: PRODUCT_A, quantity: 3 },
            ],
          })
        )
      )

      expect(mockPrisma.product.findUnique).toHaveBeenCalledTimes(1)
      expect(tx.orderItem.create).toHaveBeenCalledTimes(1)
      expect(tx.product.updateMany).toHaveBeenCalledTimes(1)
      expect(tx.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { stock: { decrement: 5 } },
        })
      )
    })

    it('checks aggregated quantity against stock, not each entry separately', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(product({ stock: 4 }))

      const response = await POST(
        request(
          validBody({
            items: [
              { productId: PRODUCT_A, quantity: 3 },
              { productId: PRODUCT_A, quantity: 3 },
            ],
          })
        )
      )

      expect(response.status).toBe(400)
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })
  })

  describe('product availability', () => {
    it('rejects an unknown product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null)

      expect((await POST(request(validBody()))).status).toBe(400)
    })

    it('rejects an inactive product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(product({ isActive: false }))

      expect((await POST(request(validBody()))).status).toBe(400)
    })

    it('rejects an order exceeding available stock', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(product({ stock: 1 }))

      expect((await POST(request(validBody()))).status).toBe(400)
    })
  })

  describe('atomic inventory reservation', () => {
    it('reserves stock with a conditional predicate that prevents overselling', async () => {
      const tx = buildTx()
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx))

      await POST(request(validBody()))

      expect(tx.product.updateMany).toHaveBeenCalledWith({
        where: { id: PRODUCT_A, isActive: true, stock: { gte: 2 } },
        data: { stock: { decrement: 2 } },
      })
    })

    it('returns 409 when the reservation loses a concurrent race', async () => {
      const tx = buildTx()
      tx.product.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx))

      const response = await POST(request(validBody()))

      expect(response.status).toBe(409)
    })

    it('does not clear the cart when the order transaction fails', async () => {
      mockPrisma.$transaction.mockRejectedValue(
        new Error(`Insufficient stock for product ${PRODUCT_A}`)
      )

      const response = await POST(request(validBody()))

      expect(response.status).toBe(409)
      expect(mockPrisma.cartItem.deleteMany).not.toHaveBeenCalled()
    })
  })

  describe('address ownership', () => {
    it('rejects a saved address belonging to another user', async () => {
      const tx = buildTx()
      tx.address.findFirst.mockResolvedValue(null)
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx))

      const response = await POST(
        request(validBody({ shippingAddress: { ...shippingAddress, id: 'addr_other' } }))
      )

      expect(response.status).toBe(500)
      expect(tx.address.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'addr_other', userId: USER_ID },
        })
      )
    })
  })

  describe('duplicate submission', () => {
    it('blocks a second order while a recent pending order exists', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({ id: 'existing' })

      const response = await POST(request(validBody()))

      expect(response.status).toBe(400)
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })
  })

  describe('successful creation', () => {
    it('creates a pending unpaid order and clears the cart', async () => {
      const tx = buildTx()
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx))

      const response = await POST(request(validBody()))

      expect(response.status).toBe(201)
      expect(tx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
            paymentStatus: 'PENDING',
            userId: USER_ID,
          }),
        })
      )
      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
      })
    })
  })
})
