import { NextRequest } from 'next/server'
import { POST } from '../retry-refunds/route'
import { prisma } from '@/lib/prisma'
import { processLatePaymentRefund } from '@/lib/razorpay'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    paymentLog: { findMany: jest.fn() },
  },
}))

jest.mock('@/lib/razorpay', () => ({
  processLatePaymentRefund: jest.fn(),
}))

const mockPrisma = prisma as any
const mockRefund = processLatePaymentRefund as jest.Mock
const SECRET = 'cron-secret-value'

function request(authorization?: string) {
  const headers: Record<string, string> = {}
  if (authorization !== undefined) {
    headers.authorization = authorization
  }

  return new NextRequest('http://localhost:3000/api/cron/retry-refunds', {
    method: 'POST',
    headers,
  } as any)
}

const result = (status: string, attempted = true) => ({
  paymentLogId: 'log',
  status,
  refundId: 'rfnd',
  attempted,
})

describe('POST /api/cron/retry-refunds', () => {
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
      expect(mockPrisma.paymentLog.findMany).not.toHaveBeenCalled()
    })

    it('rejects a missing authorization header', async () => {
      const response = await POST(request())

      expect(response.status).toBe(401)
      expect(mockRefund).not.toHaveBeenCalled()
    })

    it('rejects an incorrect secret and never issues a refund', async () => {
      const response = await POST(request('Bearer wrong-secret'))

      expect(response.status).toBe(401)
      expect(mockPrisma.paymentLog.findMany).not.toHaveBeenCalled()
      expect(mockRefund).not.toHaveBeenCalled()
    })
  })

  describe('selection criteria', () => {
    it('selects only refundable logs that are pending, failed, or stale processing', async () => {
      mockPrisma.paymentLog.findMany.mockResolvedValue([])

      await POST(request(`Bearer ${SECRET}`))

      const args = mockPrisma.paymentLog.findMany.mock.calls[0][0]
      expect(args.where.razorpayPaymentId).toEqual({ not: null })
      expect(args.where.refundAmount).toEqual({ not: null })
      expect(args.where.OR[0].refundStatus).toEqual({ in: ['PENDING', 'FAILED'] })
      expect(args.where.OR[1].refundStatus).toBe('PROCESSING')
      expect(args.take).toBe(50)
    })

    it('never selects a succeeded refund', async () => {
      mockPrisma.paymentLog.findMany.mockResolvedValue([])

      await POST(request(`Bearer ${SECRET}`))

      const serialized = JSON.stringify(
        mockPrisma.paymentLog.findMany.mock.calls[0][0].where
      )
      expect(serialized).not.toContain('SUCCEEDED')
    })
  })

  describe('processing', () => {
    it('tallies each refund outcome', async () => {
      mockPrisma.paymentLog.findMany.mockResolvedValue([
        { id: 'a' },
        { id: 'b' },
        { id: 'c' },
      ])
      mockRefund
        .mockResolvedValueOnce(result('SUCCEEDED'))
        .mockResolvedValueOnce(result('FAILED'))
        .mockResolvedValueOnce(result('PENDING'))

      const response = await POST(request(`Bearer ${SECRET}`))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body).toEqual({
        checked: 3,
        attempted: 3,
        pending: 1,
        succeeded: 1,
        failed: 1,
        errors: 0,
      })
    })

    it('delegates refunds one payment log at a time', async () => {
      mockPrisma.paymentLog.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }])
      mockRefund.mockResolvedValue(result('SUCCEEDED'))

      await POST(request(`Bearer ${SECRET}`))

      expect(mockRefund).toHaveBeenNthCalledWith(1, 'a')
      expect(mockRefund).toHaveBeenNthCalledWith(2, 'b')
    })

    it('does not count a skipped claim as attempted', async () => {
      mockPrisma.paymentLog.findMany.mockResolvedValue([{ id: 'a' }])
      mockRefund.mockResolvedValue(result('PROCESSING', false))

      const body = await (await POST(request(`Bearer ${SECRET}`))).json()

      expect(body.attempted).toBe(0)
      expect(body.checked).toBe(1)
    })

    it('continues after one refund throws and reports a failure status', async () => {
      mockPrisma.paymentLog.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }])
      mockRefund
        .mockRejectedValueOnce(new Error('gateway down'))
        .mockResolvedValueOnce(result('SUCCEEDED'))

      const response = await POST(request(`Bearer ${SECRET}`))
      const body = await response.json()

      expect(mockRefund).toHaveBeenCalledTimes(2)
      expect(body.errors).toBe(1)
      expect(body.succeeded).toBe(1)
      expect(response.status).toBe(500)
    })

    it('reports success when there is nothing to retry', async () => {
      mockPrisma.paymentLog.findMany.mockResolvedValue([])

      const response = await POST(request(`Bearer ${SECRET}`))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.checked).toBe(0)
      expect(mockRefund).not.toHaveBeenCalled()
    })
  })
})
