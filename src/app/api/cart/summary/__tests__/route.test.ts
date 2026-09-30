import { NextRequest } from 'next/server'
import { GET } from '../route'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { calculateOrderTax } from '@/lib/taxEngine'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    cartItem: { findMany: jest.fn() },
    address: { findFirst: jest.fn() },
  },
}))

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/taxEngine', () => ({ calculateOrderTax: jest.fn() }))

const mockPrisma = prisma as any
const mockAuth = auth as jest.Mock
const mockTax = calculateOrderTax as jest.Mock

function request() {
  return new NextRequest('http://localhost:3000/api/cart/summary') as any
}

function cartItem(price: number, quantity: number) {
  return {
    quantity,
    product: {
      id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      name: 'Widget',
      slug: 'widget',
      price,
      stock: 10,
      isActive: true,
      images: [],
      weight: 1,
      weightUnit: 'KG',
      category: { name: 'Tools' },
    },
  }
}

describe('GET /api/cart/summary payment methods', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...ORIGINAL_ENV,
      RAZORPAY_KEY_ID: 'rzp_test_key',
      RAZORPAY_KEY_SECRET: 'test_secret',
    }
    delete process.env.PAYMENT_METHODS_DISABLED

    mockAuth.mockResolvedValue({ user: { id: 'user_1' } })
    mockPrisma.cartItem.findMany.mockResolvedValue([cartItem(100, 2)])
    mockPrisma.address.findFirst.mockResolvedValue(null)
    mockTax.mockResolvedValue({
      subtotal: 200,
      totalTaxAmount: 0,
      taxBreakdown: [],
      finalTotal: 250,
    })
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  it('returns the available methods for the cart total', async () => {
    const payload = await (await GET(request())).json()

    expect(payload.paymentMethods).toEqual([
      expect.objectContaining({ value: 'card' }),
      expect.objectContaining({ value: 'upi' }),
    ])
  })

  it('resolves availability against the server total, not the client', async () => {
    mockTax.mockResolvedValue({
      subtotal: 150000,
      totalTaxAmount: 0,
      taxBreakdown: [],
      finalTotal: 150000,
    })

    const payload = await (await GET(request())).json()

    // UPI is over its limit at this total and must not be offered.
    expect(payload.paymentMethods.map((m: any) => m.value)).toEqual(['card'])
  })

  it('honours the env kill switch', async () => {
    process.env.PAYMENT_METHODS_DISABLED = 'card'

    const payload = await (await GET(request())).json()

    expect(payload.paymentMethods.map((m: any) => m.value)).toEqual(['upi'])
  })

  it('returns an empty list when the gateway is unconfigured', async () => {
    delete process.env.RAZORPAY_KEY_SECRET

    const payload = await (await GET(request())).json()

    expect(payload.paymentMethods).toEqual([])
  })

  it('never leaks gateway or limit configuration to the client', async () => {
    const payload = await (await GET(request())).json()

    for (const method of payload.paymentMethods) {
      expect(Object.keys(method).sort()).toEqual(['description', 'label', 'value'])
    }
  })

  it('includes an empty list for an empty cart', async () => {
    mockPrisma.cartItem.findMany.mockResolvedValue([])

    const payload = await (await GET(request())).json()

    expect(payload.paymentMethods).toEqual([])
  })

  it('rejects an unauthenticated request', async () => {
    mockAuth.mockResolvedValue(null)

    expect((await GET(request())).status).toBe(401)
  })
})
