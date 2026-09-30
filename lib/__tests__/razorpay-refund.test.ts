/**
 * @jest-environment node
 */
import crypto from 'crypto'

const mockRazorpayClient = {
  payments: {
    refund: jest.fn(),
    fetchRefund: jest.fn(),
    fetchMultipleRefund: jest.fn(),
  },
}

jest.mock('razorpay', () =>
  jest.fn().mockImplementation(() => mockRazorpayClient)
)

jest.mock('@/lib/prisma', () => ({
  prisma: {
    paymentLog: {
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    order: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

import { prisma } from '@/lib/prisma'
import {
  getLatePaymentRefundReceipt,
  processLatePaymentRefund,
  verifyWebhookSignature,
} from '@/lib/razorpay'

const mockPrisma = prisma as any

const PAYMENT_LOG_ID = '507f1f77bcf86cd799439012'
const ORDER_ID = '507f1f77bcf86cd799439011'
const RAZORPAY_PAYMENT_ID = 'pay_TEST123'
const REFUND_AMOUNT = 50000

function claimedLog(overrides: Record<string, unknown> = {}) {
  return {
    id: PAYMENT_LOG_ID,
    orderId: ORDER_ID,
    razorpayPaymentId: RAZORPAY_PAYMENT_ID,
    refundId: null,
    refundReceipt: getLatePaymentRefundReceipt(PAYMENT_LOG_ID),
    refundAmount: REFUND_AMOUNT,
    refundRetryCount: 1,
    ...overrides,
  }
}

function lastUpdateData(callIndex = -1) {
  const calls = mockPrisma.paymentLog.updateMany.mock.calls
  const index = callIndex < 0 ? calls.length + callIndex : callIndex
  return calls[index][0].data
}

describe('verifyWebhookSignature', () => {
  const secret = 'webhook-secret'
  const body = JSON.stringify({ event: 'payment.captured' })
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex')

  it('accepts a signature computed over the exact raw body', () => {
    expect(verifyWebhookSignature(body, signature, secret)).toBe(true)
  })

  it('rejects a signature when the body was tampered with', () => {
    expect(verifyWebhookSignature(body + ' ', signature, secret)).toBe(false)
  })

  it('rejects a signature produced with a different secret', () => {
    const forged = crypto.createHmac('sha256', 'other-secret').update(body).digest('hex')
    expect(verifyWebhookSignature(body, forged, secret)).toBe(false)
  })

  it('rejects empty body or signature', () => {
    expect(verifyWebhookSignature('', signature, secret)).toBe(false)
    expect(verifyWebhookSignature(body, '', secret)).toBe(false)
  })

  it('rejects a signature of the wrong length without throwing', () => {
    expect(verifyWebhookSignature(body, 'abc123', secret)).toBe(false)
  })
})

describe('getLatePaymentRefundReceipt', () => {
  it('is deterministic for the same payment log', () => {
    expect(getLatePaymentRefundReceipt(PAYMENT_LOG_ID)).toBe(
      getLatePaymentRefundReceipt(PAYMENT_LOG_ID)
    )
  })

  it('differs across payment logs', () => {
    expect(getLatePaymentRefundReceipt('a')).not.toBe(getLatePaymentRefundReceipt('b'))
  })
})

describe('processLatePaymentRefund', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      RAZORPAY_KEY_ID: 'rzp_test_abc123',
      RAZORPAY_KEY_SECRET: 'test-secret',
      RAZORPAY_MODE: 'test',
    }
    mockPrisma.$transaction.mockImplementation((cb: any) =>
      cb({
        paymentLog: { updateMany: mockPrisma.paymentLog.updateMany },
        order: { updateMany: mockPrisma.order.updateMany },
      })
    )
    mockPrisma.order.updateMany.mockResolvedValue({ count: 1 })
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('does not contact Razorpay when the refund claim is not acquired', async () => {
    mockPrisma.paymentLog.updateMany.mockResolvedValue({ count: 0 })
    mockPrisma.paymentLog.findUnique.mockResolvedValue({
      refundStatus: 'PROCESSING',
      refundId: 'rfnd_existing',
    })

    const result = await processLatePaymentRefund(PAYMENT_LOG_ID)

    expect(result).toEqual({
      paymentLogId: PAYMENT_LOG_ID,
      status: 'PROCESSING',
      refundId: 'rfnd_existing',
      attempted: false,
    })
    expect(mockRazorpayClient.payments.refund).not.toHaveBeenCalled()
  })

  it('only claims refunds that are pending, failed, or stale processing', async () => {
    mockPrisma.paymentLog.updateMany.mockResolvedValue({ count: 0 })
    mockPrisma.paymentLog.findUnique.mockResolvedValue({
      refundStatus: 'SUCCEEDED',
      refundId: 'rfnd_done',
    })

    await processLatePaymentRefund(PAYMENT_LOG_ID)

    const claimWhere = mockPrisma.paymentLog.updateMany.mock.calls[0][0].where
    expect(claimWhere.razorpayPaymentId).toEqual({ not: null })
    expect(claimWhere.OR[0].refundStatus).toEqual({ in: ['PENDING', 'FAILED'] })
    expect(claimWhere.OR[1].refundStatus).toBe('PROCESSING')
    expect(claimWhere.OR[1].refundLastAttemptAt.lt).toBeInstanceOf(Date)
  })

  it('refunds the exact captured amount and marks the payment refunded', async () => {
    mockPrisma.paymentLog.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.paymentLog.findUnique.mockResolvedValue(claimedLog())
    mockRazorpayClient.payments.fetchMultipleRefund.mockResolvedValue({ items: [] })
    mockRazorpayClient.payments.refund.mockResolvedValue({
      id: 'rfnd_new',
      payment_id: RAZORPAY_PAYMENT_ID,
      amount: REFUND_AMOUNT,
      status: 'processed',
      receipt: getLatePaymentRefundReceipt(PAYMENT_LOG_ID),
    })

    const result = await processLatePaymentRefund(PAYMENT_LOG_ID)

    expect(mockRazorpayClient.payments.refund).toHaveBeenCalledWith(
      RAZORPAY_PAYMENT_ID,
      expect.objectContaining({
        amount: REFUND_AMOUNT,
        receipt: getLatePaymentRefundReceipt(PAYMENT_LOG_ID),
      })
    )
    expect(result.status).toBe('SUCCEEDED')
    expect(result.refundId).toBe('rfnd_new')

    const data = lastUpdateData()
    expect(data.refundStatus).toBe('SUCCEEDED')
    expect(data.status).toBe('REFUNDED')
    expect(data.refundFailureReason).toBeNull()

    const orderUpdate = mockPrisma.order.updateMany.mock.calls[0][0]
    expect(orderUpdate.data.status).toBe('CANCELLED')
    expect(orderUpdate.data.paymentStatus).toBe('REFUNDED')
  })

  it('reuses an existing provider refund with the same receipt instead of refunding twice', async () => {
    mockPrisma.paymentLog.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.paymentLog.findUnique.mockResolvedValue(claimedLog())
    mockRazorpayClient.payments.fetchMultipleRefund.mockResolvedValue({
      items: [
        {
          id: 'rfnd_existing',
          payment_id: RAZORPAY_PAYMENT_ID,
          amount: REFUND_AMOUNT,
          status: 'processed',
          receipt: getLatePaymentRefundReceipt(PAYMENT_LOG_ID),
        },
      ],
    })

    const result = await processLatePaymentRefund(PAYMENT_LOG_ID)

    expect(mockRazorpayClient.payments.refund).not.toHaveBeenCalled()
    expect(result.status).toBe('SUCCEEDED')
    expect(result.refundId).toBe('rfnd_existing')
  })

  it('reuses a previously recorded refund id without creating a new refund', async () => {
    mockPrisma.paymentLog.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.paymentLog.findUnique.mockResolvedValue(claimedLog({ refundId: 'rfnd_known' }))
    mockRazorpayClient.payments.fetchRefund.mockResolvedValue({
      id: 'rfnd_known',
      payment_id: RAZORPAY_PAYMENT_ID,
      amount: REFUND_AMOUNT,
      status: 'processed',
      receipt: getLatePaymentRefundReceipt(PAYMENT_LOG_ID),
    })

    const result = await processLatePaymentRefund(PAYMENT_LOG_ID)

    expect(mockRazorpayClient.payments.fetchRefund).toHaveBeenCalledWith(
      RAZORPAY_PAYMENT_ID,
      'rfnd_known'
    )
    expect(mockRazorpayClient.payments.refund).not.toHaveBeenCalled()
    expect(result.status).toBe('SUCCEEDED')
  })

  it('retries with a new receipt when the previous provider refund failed', async () => {
    mockPrisma.paymentLog.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.paymentLog.findUnique.mockResolvedValue(
      claimedLog({ refundId: 'rfnd_failed', refundRetryCount: 3 })
    )
    mockRazorpayClient.payments.fetchRefund.mockResolvedValue({
      id: 'rfnd_failed',
      payment_id: RAZORPAY_PAYMENT_ID,
      amount: REFUND_AMOUNT,
      status: 'failed',
    })
    mockRazorpayClient.payments.fetchMultipleRefund.mockResolvedValue({ items: [] })
    mockRazorpayClient.payments.refund.mockResolvedValue({
      id: 'rfnd_retry',
      payment_id: RAZORPAY_PAYMENT_ID,
      amount: REFUND_AMOUNT,
      status: 'processed',
      receipt: `${getLatePaymentRefundReceipt(PAYMENT_LOG_ID)}_3`,
    })

    const result = await processLatePaymentRefund(PAYMENT_LOG_ID)

    expect(mockRazorpayClient.payments.refund).toHaveBeenCalledWith(
      RAZORPAY_PAYMENT_ID,
      expect.objectContaining({
        amount: REFUND_AMOUNT,
        receipt: `${getLatePaymentRefundReceipt(PAYMENT_LOG_ID)}_3`,
      })
    )
    expect(result.status).toBe('SUCCEEDED')
  })

  it('fails the refund when the provider amount does not match the verified amount', async () => {
    mockPrisma.paymentLog.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.paymentLog.findUnique.mockResolvedValue(claimedLog())
    mockRazorpayClient.payments.fetchMultipleRefund.mockResolvedValue({ items: [] })
    mockRazorpayClient.payments.refund.mockResolvedValue({
      id: 'rfnd_bad',
      payment_id: RAZORPAY_PAYMENT_ID,
      amount: REFUND_AMOUNT + 100,
      status: 'processed',
    })

    const result = await processLatePaymentRefund(PAYMENT_LOG_ID)

    expect(result.status).toBe('FAILED')
    const data = lastUpdateData()
    expect(data.refundStatus).toBe('FAILED')
    expect(data.refundFailureReason).toContain('does not match')
    expect(mockPrisma.order.updateMany).not.toHaveBeenCalled()
  })

  it('records a retryable failure when the gateway throws', async () => {
    mockPrisma.paymentLog.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.paymentLog.findUnique.mockResolvedValue(claimedLog())
    mockRazorpayClient.payments.fetchMultipleRefund.mockResolvedValue({ items: [] })
    mockRazorpayClient.payments.refund.mockRejectedValue(new Error('Gateway unavailable'))

    const result = await processLatePaymentRefund(PAYMENT_LOG_ID)

    expect(result).toEqual({
      paymentLogId: PAYMENT_LOG_ID,
      status: 'FAILED',
      refundId: null,
      attempted: true,
    })
    const data = lastUpdateData()
    expect(data.refundStatus).toBe('FAILED')
    expect(data.refundFailureReason).toBe('Gateway unavailable')
    expect(data.refundFailedAt).toBeInstanceOf(Date)
  })

  it('keeps the refund pending when the provider has not settled it yet', async () => {
    mockPrisma.paymentLog.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.paymentLog.findUnique.mockResolvedValue(claimedLog())
    mockRazorpayClient.payments.fetchMultipleRefund.mockResolvedValue({ items: [] })
    mockRazorpayClient.payments.refund.mockResolvedValue({
      id: 'rfnd_pending',
      payment_id: RAZORPAY_PAYMENT_ID,
      amount: REFUND_AMOUNT,
      status: 'pending',
    })

    const result = await processLatePaymentRefund(PAYMENT_LOG_ID)

    expect(result.status).toBe('PENDING')
    expect(lastUpdateData().refundStatus).toBe('PENDING')
    expect(mockPrisma.order.updateMany).not.toHaveBeenCalled()
  })

  it('fails a claim that has an invalid refund amount', async () => {
    mockPrisma.paymentLog.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.paymentLog.findUnique.mockResolvedValue(claimedLog({ refundAmount: 0 }))

    const result = await processLatePaymentRefund(PAYMENT_LOG_ID)

    expect(result.status).toBe('FAILED')
    expect(mockRazorpayClient.payments.refund).not.toHaveBeenCalled()
    expect(lastUpdateData().refundFailureReason).toContain('invalid gateway payment details')
  })

  it('guards every state write behind the PROCESSING claim', async () => {
    mockPrisma.paymentLog.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.paymentLog.findUnique.mockResolvedValue(claimedLog())
    mockRazorpayClient.payments.fetchMultipleRefund.mockResolvedValue({ items: [] })
    mockRazorpayClient.payments.refund.mockResolvedValue({
      id: 'rfnd_new',
      payment_id: RAZORPAY_PAYMENT_ID,
      amount: REFUND_AMOUNT,
      status: 'processed',
    })

    await processLatePaymentRefund(PAYMENT_LOG_ID)

    const writes = mockPrisma.paymentLog.updateMany.mock.calls.slice(1)
    expect(writes.length).toBeGreaterThan(0)
    writes.forEach(([arg]: any[]) => {
      expect(arg.where.refundStatus).toBe('PROCESSING')
    })
  })
})
