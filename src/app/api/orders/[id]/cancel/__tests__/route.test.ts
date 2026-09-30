import { NextRequest } from 'next/server'
import { POST } from '../route'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { isSameOriginRequest } from '@/lib/security'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    order: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/security', () => ({ isSameOriginRequest: jest.fn() }))

const mockPrisma = prisma as any
const mockAuth = auth as jest.Mock
const mockSameOrigin = isSameOriginRequest as jest.Mock

const USER_ID = 'user_1'
const ORDER_ID = '507f1f77bcf86cd799439011'

function request() {
  return new NextRequest('http://localhost:3000/api/orders/x/cancel', {
    method: 'POST',
  } as any)
}

const params = Promise.resolve({ id: ORDER_ID })

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    status: 'PENDING',
    fulfillmentStatus: 'UNFULFILLED',
    paymentStatus: 'PENDING',
    orderItems: [
      { productId: 'prod_1', quantity: 2 },
      { productId: 'prod_2', quantity: 1 },
    ],
    ...overrides,
  }
}

function buildTx() {
  return {
    order: { updateMany: jest.fn() },
    product: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    paymentLog: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  }
}

describe('POST /api/orders/[id]/cancel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSameOrigin.mockReturnValue(true)
    mockAuth.mockResolvedValue({ user: { id: USER_ID } })
  })

  describe('request authorization', () => {
    it('rejects a cross-origin request before authenticating', async () => {
      mockSameOrigin.mockReturnValue(false)

      const response = await POST(request(), { params })

      expect(response.status).toBe(403)
      expect(mockAuth).not.toHaveBeenCalled()
      expect(mockPrisma.order.findFirst).not.toHaveBeenCalled()
    })

    it('rejects an unauthenticated request', async () => {
      mockAuth.mockResolvedValue(null)

      const response = await POST(request(), { params })

      expect(response.status).toBe(401)
      expect(mockPrisma.order.findFirst).not.toHaveBeenCalled()
    })

    it('scopes the order lookup to the session user so another user cannot cancel it', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null)

      const response = await POST(request(), { params })

      expect(response.status).toBe(404)
      expect(mockPrisma.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ORDER_ID, userId: USER_ID },
        })
      )
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })
  })

  describe('shipping protection', () => {
    it.each([
      ['SHIPPED', 'UNFULFILLED'],
      ['DELIVERED', 'FULFILLED'],
      ['PROCESSING', 'PARTIAL'],
      ['PROCESSING', 'FULFILLED'],
    ])('refuses to cancel a %s / %s order', async (status, fulfillmentStatus) => {
      mockPrisma.order.findFirst.mockResolvedValue(order({ status, fulfillmentStatus }))

      const response = await POST(request(), { params })
      const body = await response.json()

      expect(response.status).toBe(409)
      expect(body.cancelled).toBe(false)
      expect(body.code).toBe('ORDER_ALREADY_SHIPPED')
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })
  })

  describe('paid payment protection', () => {
    it.each(['AUTHORIZED', 'PAID'])(
      'does not cancel or restock when payment is %s',
      async (paymentStatus) => {
        mockPrisma.order.findFirst.mockResolvedValue(order({ paymentStatus }))

        const response = await POST(request(), { params })
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.cancelled).toBe(false)
        expect(mockPrisma.$transaction).not.toHaveBeenCalled()
      }
    )

    it('does not cancel an order that is already confirmed', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(
        order({ status: 'CONFIRMED', paymentStatus: 'PAID' })
      )

      const body = await (await POST(request(), { params })).json()

      expect(body.cancelled).toBe(false)
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })
  })

  describe('successful cancellation', () => {
    it('cancels the order and restores stock for every item', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(order())
      const tx = buildTx()
      tx.order.updateMany.mockResolvedValue({ count: 1 })
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx))

      const response = await POST(request(), { params })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.cancelled).toBe(true)

      expect(tx.product.updateMany).toHaveBeenCalledTimes(2)
      expect(tx.product.updateMany).toHaveBeenCalledWith({
        where: { id: 'prod_1' },
        data: { stock: { increment: 2 } },
      })
      expect(tx.product.updateMany).toHaveBeenCalledWith({
        where: { id: 'prod_2' },
        data: { stock: { increment: 1 } },
      })
    })

    it('guards the cancel write on user, status, and payment status', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(order())
      const tx = buildTx()
      tx.order.updateMany.mockResolvedValue({ count: 1 })
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx))

      await POST(request(), { params })

      expect(tx.order.updateMany.mock.calls[0][0].where).toEqual({
        id: ORDER_ID,
        userId: USER_ID,
        status: 'PENDING',
        paymentStatus: 'PENDING',
      })
    })

    it('cancels only pending payment logs', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(order())
      const tx = buildTx()
      tx.order.updateMany.mockResolvedValue({ count: 1 })
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx))

      await POST(request(), { params })

      expect(tx.paymentLog.updateMany.mock.calls[0][0].where).toEqual({
        orderId: ORDER_ID,
        status: 'PENDING',
      })
    })
  })

  describe('race with an inbound payment', () => {
    it('does not restock when the guarded cancel write matches no row', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(order())
      const tx = buildTx()
      tx.order.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx))

      const body = await (await POST(request(), { params })).json()

      expect(body.cancelled).toBe(false)
      expect(tx.product.updateMany).not.toHaveBeenCalled()
      expect(tx.paymentLog.updateMany).not.toHaveBeenCalled()
    })
  })
})
