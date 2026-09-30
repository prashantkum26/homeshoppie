import { NextRequest } from 'next/server'
import { POST } from '../release-expired-orders/route'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    order: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}))

const mockPrisma = prisma as any
const SECRET = 'cron-secret-value'

function request(authorization?: string) {
  const headers: Record<string, string> = {}
  if (authorization !== undefined) {
    headers.authorization = authorization
  }

  return new NextRequest('http://localhost:3000/api/cron/release-expired-orders', {
    method: 'POST',
    headers,
  } as any)
}

function buildTx() {
  return {
    order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    product: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    paymentLog: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  }
}

describe('POST /api/cron/release-expired-orders', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv, CRON_SECRET: SECRET }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('authorization', () => {
    it('refuses to run when CRON_SECRET is not configured', async () => {
      delete process.env.CRON_SECRET

      const response = await POST(request(`Bearer ${SECRET}`))

      expect(response.status).toBe(503)
      expect(mockPrisma.order.findMany).not.toHaveBeenCalled()
    })

    it('rejects a missing authorization header', async () => {
      const response = await POST(request())

      expect(response.status).toBe(401)
      expect(mockPrisma.order.findMany).not.toHaveBeenCalled()
    })

    it('rejects an incorrect secret', async () => {
      const response = await POST(request('Bearer wrong-secret'))

      expect(response.status).toBe(401)
      expect(mockPrisma.order.findMany).not.toHaveBeenCalled()
    })

    it('rejects a bare secret without the Bearer scheme', async () => {
      const response = await POST(request(SECRET))

      expect(response.status).toBe(401)
      expect(mockPrisma.order.findMany).not.toHaveBeenCalled()
    })

    it('accepts the correct bearer secret', async () => {
      mockPrisma.order.findMany.mockResolvedValue([])

      const response = await POST(request(`Bearer ${SECRET}`))

      expect(response.status).toBe(200)
      expect(mockPrisma.order.findMany).toHaveBeenCalled()
    })
  })

  describe('selection criteria', () => {
    it('only selects pending unpaid orders older than the cutoff', async () => {
      mockPrisma.order.findMany.mockResolvedValue([])

      await POST(request(`Bearer ${SECRET}`))

      const where = mockPrisma.order.findMany.mock.calls[0][0].where
      expect(where.status).toBe('PENDING')
      expect(where.paymentStatus).toEqual({ in: ['PENDING', 'AUTHORIZED'] })
      expect(where.createdAt.lt).toBeInstanceOf(Date)
      expect(where.createdAt.lt.getTime()).toBeLessThan(Date.now())
    })
  })

  describe('inventory release', () => {
    it('restores stock for each item of an expired order', async () => {
      mockPrisma.order.findMany.mockResolvedValue([
        { id: 'order_1', orderItems: [{ productId: 'p1', quantity: 3 }] },
      ])
      const tx = buildTx()
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx))

      const body = await (await POST(request(`Bearer ${SECRET}`))).json()

      expect(body).toEqual({ released: 1, checked: 1 })
      expect(tx.product.updateMany).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { stock: { increment: 3 } },
      })
    })

    it('does not restock when the order was already settled concurrently', async () => {
      mockPrisma.order.findMany.mockResolvedValue([
        { id: 'order_1', orderItems: [{ productId: 'p1', quantity: 3 }] },
      ])
      const tx = buildTx()
      tx.order.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx))

      const body = await (await POST(request(`Bearer ${SECRET}`))).json()

      expect(body).toEqual({ released: 0, checked: 1 })
      expect(tx.product.updateMany).not.toHaveBeenCalled()
      expect(tx.paymentLog.updateMany).not.toHaveBeenCalled()
    })

    it('guards the cancel write so a paid order can never be expired', async () => {
      mockPrisma.order.findMany.mockResolvedValue([
        { id: 'order_1', orderItems: [] },
      ])
      const tx = buildTx()
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx))

      await POST(request(`Bearer ${SECRET}`))

      expect(tx.order.updateMany.mock.calls[0][0].where).toEqual({
        id: 'order_1',
        status: 'PENDING',
        paymentStatus: { in: ['PENDING', 'AUTHORIZED'] },
      })
    })

    it('processes each expired order independently', async () => {
      mockPrisma.order.findMany.mockResolvedValue([
        { id: 'order_1', orderItems: [{ productId: 'p1', quantity: 1 }] },
        { id: 'order_2', orderItems: [{ productId: 'p2', quantity: 5 }] },
      ])
      const tx = buildTx()
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx))

      const body = await (await POST(request(`Bearer ${SECRET}`))).json()

      expect(body).toEqual({ released: 2, checked: 2 })
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2)
    })

    it('reports nothing released when no orders have expired', async () => {
      mockPrisma.order.findMany.mockResolvedValue([])

      const body = await (await POST(request(`Bearer ${SECRET}`))).json()

      expect(body).toEqual({ released: 0, checked: 0 })
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })
  })
})
