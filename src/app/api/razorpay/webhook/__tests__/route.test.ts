import { NextRequest } from 'next/server'
import { POST } from '../route'
import { prisma } from '@/lib/prisma'
import {
  verifyWebhookSignature,
  processLatePaymentRefund,
} from '@/lib/razorpay'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    paymentLog: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    order: {
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    product: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

jest.mock('@/lib/razorpay', () => ({
  verifyWebhookSignature: jest.fn(),
  processLatePaymentRefund: jest.fn(),
  getLatePaymentRefundReceipt: (id: string) => `late_${id}`,
}))

jest.mock('@/lib/security', () => ({
  logSecurityEvent: jest.fn().mockResolvedValue(undefined),
  getClientIP: jest.fn().mockReturnValue('127.0.0.1'),
}))

const mockPrisma = prisma as any
const mockVerify = verifyWebhookSignature as jest.Mock
const mockRefund = processLatePaymentRefund as jest.Mock

const ORDER_ID = '507f1f77bcf86cd799439011'
const PAYMENT_LOG_ID = '507f1f77bcf86cd799439012'
const RAZORPAY_ORDER_ID = 'order_TEST123'
const RAZORPAY_PAYMENT_ID = 'pay_TEST123'

function buildRequest(event: Record<string, unknown>, signature: string | null = 'valid-signature') {
  const headers: Record<string, string> = {}
  if (signature !== null) {
    headers['x-razorpay-signature'] = signature
  }

  return new NextRequest('http://localhost:3000/api/razorpay/webhook', {
    method: 'POST',
    headers,
    body: JSON.stringify(event),
  } as any)
}

function capturedEvent(overrides: Record<string, unknown> = {}) {
  return {
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: RAZORPAY_PAYMENT_ID,
          order_id: RAZORPAY_ORDER_ID,
          amount: 50000,
          currency: 'INR',
          method: 'card',
          status: 'captured',
          ...overrides,
        },
      },
    },
  }
}

function paymentLog(overrides: Record<string, unknown> = {}) {
  return {
    id: PAYMENT_LOG_ID,
    orderId: ORDER_ID,
    razorpayOrderId: RAZORPAY_ORDER_ID,
    razorpayPaymentId: null,
    amount: 50000,
    currency: 'INR',
    status: 'PENDING',
    refundStatus: 'NOT_REQUIRED',
    order: {
      id: ORDER_ID,
      status: 'PENDING',
      paymentStatus: 'PENDING',
      paymentMethod: 'card',
      cancelledAt: null,
      orderItems: [{ productId: 'prod_1', quantity: 2 }],
    },
    ...overrides,
  }
}

function buildTx() {
  return {
    order: {
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    paymentLog: {
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    product: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  }
}

describe('/api/razorpay/webhook - POST', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockVerify.mockReturnValue(true)
  })

  describe('signature verification', () => {
    it('rejects a request with no signature header and never touches the database', async () => {
      const response = await POST(buildRequest(capturedEvent(), null))

      expect(response.status).toBe(401)
      expect(mockPrisma.paymentLog.findFirst).not.toHaveBeenCalled()
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it('rejects a request whose signature fails verification', async () => {
      mockVerify.mockReturnValue(false)

      const response = await POST(buildRequest(capturedEvent(), 'forged-signature'))

      expect(response.status).toBe(401)
      expect(mockPrisma.paymentLog.findFirst).not.toHaveBeenCalled()
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it('verifies the signature against the exact raw body', async () => {
      mockPrisma.paymentLog.findFirst.mockResolvedValue(null)
      const event = capturedEvent()

      await POST(buildRequest(event))

      expect(mockVerify).toHaveBeenCalledWith(JSON.stringify(event), 'valid-signature')
    })
  })

  describe('amount and currency validation', () => {
    it('ignores a captured payment whose amount does not match the payment log', async () => {
      mockPrisma.paymentLog.findFirst.mockResolvedValue(paymentLog())

      const response = await POST(buildRequest(capturedEvent({ amount: 1 })))

      expect(response.status).toBe(200)
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it('ignores a captured payment whose currency does not match the payment log', async () => {
      mockPrisma.paymentLog.findFirst.mockResolvedValue(paymentLog())

      await POST(buildRequest(capturedEvent({ currency: 'USD' })))

      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it('ignores a non-integer gateway amount', async () => {
      mockPrisma.paymentLog.findFirst.mockResolvedValue(paymentLog({ amount: 500.5 }))

      await POST(buildRequest(capturedEvent({ amount: 500.5 })))

      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })
  })

  describe('idempotency and replay', () => {
    it('ignores a replayed capture for an already paid payment log', async () => {
      mockPrisma.paymentLog.findFirst.mockResolvedValue(
        paymentLog({ razorpayPaymentId: RAZORPAY_PAYMENT_ID, status: 'PAID' })
      )

      await POST(buildRequest(capturedEvent()))

      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
      expect(mockRefund).not.toHaveBeenCalled()
    })

    it('blocks a payment id already recorded against a different payment log', async () => {
      mockPrisma.paymentLog.findFirst
        .mockResolvedValueOnce(paymentLog())
        .mockResolvedValueOnce({ id: 'other-log-id' })

      await POST(buildRequest(capturedEvent()))

      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })
  })

  describe('successful capture', () => {
    it('confirms the order and marks the payment paid exactly once', async () => {
      mockPrisma.paymentLog.findFirst
        .mockResolvedValueOnce(paymentLog())
        .mockResolvedValueOnce(null)

      const tx = buildTx()
      tx.order.updateMany.mockResolvedValue({ count: 1 })
      tx.paymentLog.updateMany.mockResolvedValue({ count: 1 })
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx))

      const response = await POST(buildRequest(capturedEvent()))

      expect(response.status).toBe(200)
      expect(tx.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: ORDER_ID,
            status: 'PENDING',
            paymentStatus: { in: ['PENDING', 'AUTHORIZED'] },
          }),
          data: expect.objectContaining({
            status: 'CONFIRMED',
            paymentStatus: 'PAID',
            paymentIntentId: RAZORPAY_PAYMENT_ID,
          }),
        })
      )
      expect(mockRefund).not.toHaveBeenCalled()
    })

    it('stores only a redacted gateway snapshot, never the raw payload', async () => {
      mockPrisma.paymentLog.findFirst
        .mockResolvedValueOnce(paymentLog())
        .mockResolvedValueOnce(null)

      const tx = buildTx()
      tx.order.updateMany.mockResolvedValue({ count: 1 })
      tx.paymentLog.updateMany.mockResolvedValue({ count: 1 })
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx))

      await POST(
        buildRequest(capturedEvent({ card: { number: '4111111111111111' }, email: 'a@b.com' }))
      )

      const snapshot = tx.paymentLog.updateMany.mock.calls[0][0].data.gatewayResponse
      expect(Object.keys(snapshot).sort()).toEqual([
        'amount',
        'currency',
        'error_code',
        'error_description',
        'id',
        'method',
        'order_id',
        'status',
      ])
      expect(JSON.stringify(snapshot)).not.toContain('4111111111111111')
      expect(JSON.stringify(snapshot)).not.toContain('a@b.com')
    })
  })

  describe('late capture after cancellation', () => {
    it('keeps the order cancelled and refunds the exact captured amount', async () => {
      mockPrisma.paymentLog.findFirst
        .mockResolvedValueOnce(paymentLog())
        .mockResolvedValueOnce(null)

      const tx = buildTx()
      tx.order.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 1 })
      tx.order.findUnique.mockResolvedValue({
        status: 'CANCELLED',
        paymentStatus: 'CANCELLED',
        cancelledAt: new Date(),
      })
      tx.paymentLog.updateMany.mockResolvedValue({ count: 1 })
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx))
      mockRefund.mockResolvedValue({
        paymentLogId: PAYMENT_LOG_ID,
        status: 'SUCCEEDED',
        refundId: 'rfnd_1',
        attempted: true,
      })

      const response = await POST(buildRequest(capturedEvent()))

      expect(response.status).toBe(200)
      expect(mockRefund).toHaveBeenCalledWith(PAYMENT_LOG_ID)

      const refundClaim = tx.paymentLog.updateMany.mock.calls[0][0]
      expect(refundClaim.where.refundStatus).toBe('NOT_REQUIRED')
      expect(refundClaim.data.refundStatus).toBe('PENDING')
      expect(refundClaim.data.refundAmount).toBe(50000)
      expect(refundClaim.data.refundReceipt).toBe(`late_${PAYMENT_LOG_ID}`)

      const reassertCancel = tx.order.updateMany.mock.calls[1][0]
      expect(reassertCancel.data.status).toBe('CANCELLED')
      expect(reassertCancel.data.paymentStatus).toBeUndefined()
    })

    it('does not refund twice when the refund claim was already taken', async () => {
      mockPrisma.paymentLog.findFirst
        .mockResolvedValueOnce(paymentLog())
        .mockResolvedValueOnce(null)

      const tx = buildTx()
      tx.order.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 1 })
      tx.order.findUnique.mockResolvedValue({
        status: 'CANCELLED',
        paymentStatus: 'CANCELLED',
        cancelledAt: new Date(),
      })
      tx.paymentLog.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx))

      await POST(buildRequest(capturedEvent()))

      expect(mockRefund).not.toHaveBeenCalled()
    })

    it('re-runs the refund for a replayed capture already marked for refund', async () => {
      mockPrisma.paymentLog.findFirst.mockResolvedValue(
        paymentLog({
          razorpayPaymentId: RAZORPAY_PAYMENT_ID,
          status: 'PAID',
          refundStatus: 'FAILED',
        })
      )
      mockRefund.mockResolvedValue({
        paymentLogId: PAYMENT_LOG_ID,
        status: 'SUCCEEDED',
        refundId: 'rfnd_2',
        attempted: true,
      })

      await POST(buildRequest(capturedEvent()))

      expect(mockRefund).toHaveBeenCalledWith(PAYMENT_LOG_ID)
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it('does not reopen a cancelled order for an authorized-only late payment', async () => {
      mockPrisma.paymentLog.findFirst
        .mockResolvedValueOnce(paymentLog())
        .mockResolvedValueOnce(null)

      const tx = buildTx()
      tx.order.updateMany.mockResolvedValue({ count: 0 })
      tx.order.findUnique.mockResolvedValue({
        status: 'CANCELLED',
        paymentStatus: 'CANCELLED',
        cancelledAt: new Date(),
      })
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx))

      const event = capturedEvent()
      event.event = 'payment.authorized'

      await POST(buildRequest(event))

      expect(tx.paymentLog.updateMany).not.toHaveBeenCalled()
      expect(mockRefund).not.toHaveBeenCalled()
    })
  })

  describe('payment failure', () => {
    const failedEvent = {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: RAZORPAY_PAYMENT_ID,
            order_id: RAZORPAY_ORDER_ID,
            error_code: 'BAD_REQUEST_ERROR',
            error_description: 'Payment declined',
          },
        },
      },
    }

    it('marks the payment failed and restores reserved stock', async () => {
      mockPrisma.paymentLog.findFirst
        .mockResolvedValueOnce(paymentLog())
        .mockResolvedValueOnce(null)

      const tx = buildTx()
      tx.paymentLog.updateMany.mockResolvedValue({ count: 1 })
      tx.paymentLog.count.mockResolvedValue(0)
      tx.order.updateMany.mockResolvedValue({ count: 1 })
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx))

      const response = await POST(buildRequest(failedEvent))

      expect(response.status).toBe(200)
      expect(tx.product.updateMany).toHaveBeenCalledWith({
        where: { id: 'prod_1' },
        data: { stock: { increment: 2 } },
      })
    })

    it('does not restore stock while another payment attempt is still active', async () => {
      mockPrisma.paymentLog.findFirst
        .mockResolvedValueOnce(paymentLog())
        .mockResolvedValueOnce(null)

      const tx = buildTx()
      tx.paymentLog.updateMany.mockResolvedValue({ count: 1 })
      tx.paymentLog.count.mockResolvedValue(1)
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx))

      await POST(buildRequest(failedEvent))

      expect(tx.order.updateMany).not.toHaveBeenCalled()
      expect(tx.product.updateMany).not.toHaveBeenCalled()
    })

    it('never marks an already paid payment log as failed', async () => {
      mockPrisma.paymentLog.findFirst
        .mockResolvedValueOnce(paymentLog({ status: 'PAID' }))
        .mockResolvedValueOnce(null)

      const tx = buildTx()
      tx.paymentLog.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx))

      await POST(buildRequest(failedEvent))

      expect(tx.paymentLog.updateMany.mock.calls[0][0].where.status).toEqual({ not: 'PAID' })
      expect(tx.order.updateMany).not.toHaveBeenCalled()
      expect(tx.product.updateMany).not.toHaveBeenCalled()
    })

    it('ignores a replayed failure for an already failed payment', async () => {
      mockPrisma.paymentLog.findFirst.mockResolvedValue(
        paymentLog({ razorpayPaymentId: RAZORPAY_PAYMENT_ID, status: 'FAILED' })
      )

      await POST(buildRequest(failedEvent))

      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })
  })

  describe('order.paid', () => {
    const orderPaidEvent = (overrides: Record<string, unknown> = {}) => ({
      event: 'order.paid',
      payload: {
        order: {
          entity: {
            id: RAZORPAY_ORDER_ID,
            amount_paid: 50000,
            currency: 'INR',
            status: 'paid',
            ...overrides,
          },
        },
      },
    })

    it('confirms a pending order', async () => {
      mockPrisma.paymentLog.findFirst.mockResolvedValue(paymentLog())

      const tx = buildTx()
      tx.order.updateMany.mockResolvedValue({ count: 1 })
      tx.paymentLog.updateMany.mockResolvedValue({ count: 1 })
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx))

      const response = await POST(buildRequest(orderPaidEvent()))

      expect(response.status).toBe(200)
      expect(tx.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CONFIRMED', paymentStatus: 'PAID' }),
        })
      )
    })

    it('ignores an amount_paid mismatch', async () => {
      mockPrisma.paymentLog.findFirst.mockResolvedValue(paymentLog())

      await POST(buildRequest(orderPaidEvent({ amount_paid: 1 })))

      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it('ignores a currency mismatch', async () => {
      mockPrisma.paymentLog.findFirst.mockResolvedValue(paymentLog())

      await POST(buildRequest(orderPaidEvent({ currency: 'USD' })))

      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it('refunds the exact amount when the order was already cancelled', async () => {
      mockPrisma.paymentLog.findFirst.mockResolvedValue(
        paymentLog({
          order: {
            id: ORDER_ID,
            status: 'CANCELLED',
            paymentStatus: 'CANCELLED',
            paymentMethod: 'card',
            cancelledAt: new Date(),
          },
        })
      )

      const tx = buildTx()
      tx.order.updateMany.mockResolvedValue({ count: 0 })
      tx.paymentLog.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(tx))
      mockPrisma.paymentLog.updateMany.mockResolvedValue({ count: 1 })
      mockRefund.mockResolvedValue({
        paymentLogId: PAYMENT_LOG_ID,
        status: 'SUCCEEDED',
        refundId: 'rfnd_3',
        attempted: true,
      })

      await POST(buildRequest(orderPaidEvent()))

      const claim = mockPrisma.paymentLog.updateMany.mock.calls[0][0]
      expect(claim.where.refundStatus).toBe('NOT_REQUIRED')
      expect(claim.data.refundAmount).toBe(50000)
      expect(mockRefund).toHaveBeenCalledWith(PAYMENT_LOG_ID)
    })
  })

  describe('unknown payment log', () => {
    it('acknowledges an event for an unknown Razorpay order without writing', async () => {
      mockPrisma.paymentLog.findFirst.mockResolvedValue(null)

      const response = await POST(buildRequest(capturedEvent()))

      expect(response.status).toBe(200)
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })
  })
})
