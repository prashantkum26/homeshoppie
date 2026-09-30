import { NextRequest } from 'next/server'
import { PATCH } from '../[id]/route'
import { PATCH as BULK_PATCH } from '../bulk-update/route'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/security', () => ({
  logSecurityEvent: jest.fn().mockResolvedValue(undefined),
  getClientIP: jest.fn().mockReturnValue('127.0.0.1'),
}))

const mockPrisma = prisma as any
const mockAuth = auth as jest.Mock

const ORDER_ID = '507f1f77bcf86cd799439011'
const params = Promise.resolve({ id: ORDER_ID })

function request(body: Record<string, unknown>, url = `http://localhost:3000/api/admin/orders/${ORDER_ID}`) {
  return new NextRequest(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  } as any)
}

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    orderNumber: 'ORD1',
    status: 'PENDING',
    fulfillmentStatus: 'UNFULFILLED',
    notes: null,
    user: { email: 'a@b.com', name: 'A' },
    ...overrides,
  }
}

describe('PATCH /api/admin/orders/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin_1', role: 'ADMIN' } })
    mockPrisma.order.findUnique.mockResolvedValue(order())
    mockPrisma.order.update.mockResolvedValue({ id: ORDER_ID, orderItems: [], user: {} })
  })

  it('rejects a non-admin user', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'USER' } })

    const response = await PATCH(request({ status: 'CONFIRMED' }), { params })

    expect(response.status).toBe(401)
    expect(mockPrisma.order.update).not.toHaveBeenCalled()
  })

  it('rejects an invalid status value', async () => {
    const response = await PATCH(request({ status: 'BOGUS' }), { params })

    expect(response.status).toBe(400)
    expect(mockPrisma.order.update).not.toHaveBeenCalled()
  })

  it('returns 404 for a missing order', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null)

    expect((await PATCH(request({ status: 'CONFIRMED' }), { params })).status).toBe(404)
  })

  describe('shipping protection', () => {
    it.each([
      ['SHIPPED', 'UNFULFILLED'],
      ['DELIVERED', 'FULFILLED'],
      ['PROCESSING', 'PARTIAL'],
    ])('blocks cancelling a %s / %s order', async (status, fulfillmentStatus) => {
      mockPrisma.order.findUnique.mockResolvedValue(order({ status, fulfillmentStatus }))

      const response = await PATCH(request({ status: 'CANCELLED' }), { params })
      const body = await response.json()

      expect(response.status).toBe(409)
      expect(body.code).toBe('ORDER_ALREADY_SHIPPED')
      expect(mockPrisma.order.update).not.toHaveBeenCalled()
    })
  })

  describe('transition rules', () => {
    it.each([
      ['SHIPPED', 'PROCESSING'],
      ['DELIVERED', 'SHIPPED'],
      ['SHIPPED', 'PENDING'],
    ])('blocks the backward transition %s -> %s', async (from, to) => {
      mockPrisma.order.findUnique.mockResolvedValue(order({ status: from }))

      const response = await PATCH(request({ status: to }), { params })
      const body = await response.json()

      expect(response.status).toBe(409)
      expect(body.code).toBe('INVALID_ORDER_TRANSITION')
      expect(mockPrisma.order.update).not.toHaveBeenCalled()
    })

    it.each([
      ['PENDING', 'CONFIRMED'],
      ['CONFIRMED', 'PROCESSING'],
      ['PROCESSING', 'SHIPPED'],
      ['SHIPPED', 'DELIVERED'],
    ])('allows the forward transition %s -> %s', async (from, to) => {
      mockPrisma.order.findUnique.mockResolvedValue(order({ status: from }))

      const response = await PATCH(request({ status: to }), { params })

      expect(response.status).toBe(200)
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: to }) })
      )
    })

    it('allows cancelling an unshipped pending order', async () => {
      const response = await PATCH(request({ status: 'CANCELLED' }), { params })

      expect(response.status).toBe(200)
    })
  })
})

describe('PATCH /api/admin/orders/bulk-update', () => {
  const bulkUrl = 'http://localhost:3000/api/admin/orders/bulk-update'

  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin_1', role: 'ADMIN' } })
    mockPrisma.order.updateMany.mockResolvedValue({ count: 2 })
  })

  it('rejects a non-admin user', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'USER' } })

    const response = await BULK_PATCH(
      request({ orderIds: ['a'], status: 'CONFIRMED' }, bulkUrl)
    )

    expect(response.status).toBe(401)
    expect(mockPrisma.order.updateMany).not.toHaveBeenCalled()
  })

  it('rejects a batch larger than 100 orders', async () => {
    const orderIds = Array.from({ length: 101 }, (_, i) => `id_${i}`)

    const response = await BULK_PATCH(request({ orderIds, status: 'CONFIRMED' }, bulkUrl))

    expect(response.status).toBe(400)
    expect(mockPrisma.order.updateMany).not.toHaveBeenCalled()
  })

  it('rejects an empty order list', async () => {
    const response = await BULK_PATCH(request({ orderIds: [], status: 'CONFIRMED' }, bulkUrl))

    expect(response.status).toBe(400)
  })

  it('blocks the whole batch when any order has already shipped', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      order({ id: 'o1', status: 'PENDING' }),
      order({ id: 'o2', status: 'SHIPPED' }),
    ])

    const response = await BULK_PATCH(
      request({ orderIds: ['o1', 'o2'], status: 'CANCELLED' }, bulkUrl)
    )
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('ORDER_ALREADY_SHIPPED')
    expect(mockPrisma.order.updateMany).not.toHaveBeenCalled()
  })

  it('blocks the whole batch when any transition is invalid', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      order({ id: 'o1', status: 'PENDING' }),
      order({ id: 'o2', status: 'DELIVERED' }),
    ])

    const response = await BULK_PATCH(
      request({ orderIds: ['o1', 'o2'], status: 'SHIPPED' }, bulkUrl)
    )
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('INVALID_ORDER_TRANSITION')
    expect(mockPrisma.order.updateMany).not.toHaveBeenCalled()
  })

  it('applies a valid uniform transition', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      order({ id: 'o1', status: 'PENDING' }),
      order({ id: 'o2', status: 'CONFIRMED' }),
    ])

    const response = await BULK_PATCH(
      request({ orderIds: ['o1', 'o2'], status: 'PROCESSING' }, bulkUrl)
    )

    expect(response.status).toBe(200)
    expect(mockPrisma.order.updateMany).toHaveBeenCalled()
  })

  it('returns 404 when none of the ids exist', async () => {
    mockPrisma.order.findMany.mockResolvedValue([])

    const response = await BULK_PATCH(
      request({ orderIds: ['missing'], status: 'CONFIRMED' }, bulkUrl)
    )

    expect(response.status).toBe(404)
    expect(mockPrisma.order.updateMany).not.toHaveBeenCalled()
  })
})
