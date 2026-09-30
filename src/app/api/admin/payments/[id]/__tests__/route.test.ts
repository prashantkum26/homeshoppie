import { NextRequest } from 'next/server'
import { PATCH } from '../route'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    paymentLog: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}))

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))

jest.mock('@prisma/client', () => ({
  PaymentStatus: {
    PENDING: 'PENDING',
    AUTHORIZED: 'AUTHORIZED',
    PAID: 'PAID',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
    REFUNDED: 'REFUNDED',
    PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
  },
}))

const mockPrisma = prisma as any
const mockAuth = auth as jest.Mock

const PAYMENT_ID = '507f1f77bcf86cd799439012'
const params = Promise.resolve({ id: PAYMENT_ID })

function request(body: Record<string, unknown>) {
  return new NextRequest(`http://localhost:3000/api/admin/payments/${PAYMENT_ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  } as any)
}

function existing(overrides: Record<string, unknown> = {}) {
  return {
    id: PAYMENT_ID,
    status: 'PENDING',
    refundStatus: 'NOT_REQUIRED',
    ...overrides,
  }
}

describe('PATCH /api/admin/payments/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin_1', role: 'ADMIN' } })
    mockPrisma.paymentLog.findUnique.mockResolvedValue(existing())
    mockPrisma.paymentLog.update.mockResolvedValue({ id: PAYMENT_ID })
  })

  describe('authorization', () => {
    it('rejects an unauthenticated request', async () => {
      mockAuth.mockResolvedValue(null)

      expect((await PATCH(request({ status: 'FAILED' }), { params })).status).toBe(401)
    })

    it('rejects a non-admin user', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'USER' } })

      const response = await PATCH(request({ status: 'FAILED' }), { params })

      expect(response.status).toBe(401)
      expect(mockPrisma.paymentLog.update).not.toHaveBeenCalled()
    })

    it('allows a super admin', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'sa1', role: 'SUPER_ADMIN' } })

      expect((await PATCH(request({ status: 'FAILED' }), { params })).status).toBe(200)
    })
  })

  describe('gateway-owned states cannot be set manually', () => {
    it.each(['REFUNDED', 'PARTIALLY_REFUNDED', 'PAID', 'AUTHORIZED'])(
      'refuses to set %s by hand',
      async (status) => {
        const response = await PATCH(request({ status }), { params })
        const body = await response.json()

        expect(response.status).toBe(409)
        expect(body.code).toBe('GATEWAY_OWNED_PAYMENT_STATE')
        expect(mockPrisma.paymentLog.update).not.toHaveBeenCalled()
      }
    )

    it('rejects an invalid enum value', async () => {
      const response = await PATCH(request({ status: 'NOT_A_STATUS' }), { params })

      expect(response.status).toBe(400)
      expect(mockPrisma.paymentLog.update).not.toHaveBeenCalled()
    })

    it('rejects a status that is valid but not admin-editable', async () => {
      const response = await PATCH(request({ status: 'PENDING' }), { params })
      const body = await response.json()

      expect(response.status).toBe(409)
      expect(body.code).toBe('PAYMENT_STATUS_NOT_EDITABLE')
    })
  })

  describe('settled payments are protected', () => {
    it.each(['PAID', 'REFUNDED', 'AUTHORIZED', 'PARTIALLY_REFUNDED'])(
      'refuses to edit a payment already in %s',
      async (status) => {
        mockPrisma.paymentLog.findUnique.mockResolvedValue(existing({ status }))

        const response = await PATCH(request({ status: 'FAILED' }), { params })
        const body = await response.json()

        expect(response.status).toBe(409)
        expect(body.code).toBe('PAYMENT_ALREADY_SETTLED')
        expect(mockPrisma.paymentLog.update).not.toHaveBeenCalled()
      }
    )

    it.each(['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED'])(
      'refuses to edit a payment in %s refund reconciliation',
      async (refundStatus) => {
        mockPrisma.paymentLog.findUnique.mockResolvedValue(existing({ refundStatus }))

        const response = await PATCH(request({ status: 'CANCELLED' }), { params })
        const body = await response.json()

        expect(response.status).toBe(409)
        expect(body.code).toBe('PAYMENT_IN_REFUND_RECONCILIATION')
        expect(mockPrisma.paymentLog.update).not.toHaveBeenCalled()
      }
    )

    it('returns 404 for an unknown payment', async () => {
      mockPrisma.paymentLog.findUnique.mockResolvedValue(null)

      expect((await PATCH(request({ status: 'FAILED' }), { params })).status).toBe(404)
    })
  })

  describe('permitted updates', () => {
    it.each(['FAILED', 'CANCELLED'])('allows setting %s on a pending payment', async (status) => {
      const response = await PATCH(request({ status }), { params })

      expect(response.status).toBe(200)
      expect(mockPrisma.paymentLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PAYMENT_ID },
          data: expect.objectContaining({ status }),
        })
      )
    })

    it('allows a reconcile-only update on a settled paid payment', async () => {
      mockPrisma.paymentLog.findUnique.mockResolvedValue(existing({ status: 'PAID' }))

      const response = await PATCH(request({ reconciled: true }), { params })

      expect(response.status).toBe(200)
      const data = mockPrisma.paymentLog.update.mock.calls[0][0].data
      expect(data.status).toBeUndefined()
      expect(data.reconciledBy).toBe('admin_1')
      expect(data.reconciledAt).toBeInstanceOf(Date)
    })

    it('rejects a request with no supported fields', async () => {
      const response = await PATCH(request({}), { params })

      expect(response.status).toBe(400)
      expect(mockPrisma.paymentLog.update).not.toHaveBeenCalled()
    })

    it('never writes refund fields from client input', async () => {
      await PATCH(
        request({
          status: 'FAILED',
          refundStatus: 'SUCCEEDED',
          refundAmount: 999999,
          refundId: 'rfnd_forged',
        }),
        { params }
      )

      const data = mockPrisma.paymentLog.update.mock.calls[0][0].data
      expect(data).not.toHaveProperty('refundStatus')
      expect(data).not.toHaveProperty('refundAmount')
      expect(data).not.toHaveProperty('refundId')
    })
  })
})
