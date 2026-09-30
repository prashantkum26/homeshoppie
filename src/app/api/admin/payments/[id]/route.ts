import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PaymentStatus } from '@prisma/client'

/**
 * Refund and capture states are owned by the Razorpay webhook and the refund
 * worker. Allowing them here would desynchronise the refund state machine and
 * could mark a customer as refunded without any money leaving the gateway.
 */
const ADMIN_UPDATABLE_STATUSES: PaymentStatus[] = ['FAILED', 'CANCELLED']

const GATEWAY_OWNED_STATUSES: PaymentStatus[] = [
  'PAID',
  'AUTHORIZED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
]

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: paymentId } = await params
    const body = await request.json()
    const { status, reconciled } = body

    // Validate the status against the enum
    if (status && !Object.values(PaymentStatus).includes(status)) {
      return NextResponse.json({ error: 'Invalid payment status' }, { status: 400 })
    }

    if (status && GATEWAY_OWNED_STATUSES.includes(status)) {
      return NextResponse.json(
        {
          error:
            'Paid and refund states are set by Razorpay reconciliation and cannot be changed manually.',
          code: 'GATEWAY_OWNED_PAYMENT_STATE',
        },
        { status: 409 }
      )
    }

    if (status && !ADMIN_UPDATABLE_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: 'This payment status cannot be set manually', code: 'PAYMENT_STATUS_NOT_EDITABLE' },
        { status: 409 }
      )
    }

    const existingPayment = await prisma.paymentLog.findUnique({
      where: { id: paymentId },
      select: { id: true, status: true, refundStatus: true },
    })

    if (!existingPayment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Never let a manual edit overwrite a settled or in-flight gateway outcome.
    if (status && GATEWAY_OWNED_STATUSES.includes(existingPayment.status)) {
      return NextResponse.json(
        {
          error: 'This payment has a settled gateway outcome and cannot be edited manually.',
          code: 'PAYMENT_ALREADY_SETTLED',
        },
        { status: 409 }
      )
    }

    if (status && existingPayment.refundStatus !== 'NOT_REQUIRED') {
      return NextResponse.json(
        {
          error: 'This payment is in refund reconciliation and cannot be edited manually.',
          code: 'PAYMENT_IN_REFUND_RECONCILIATION',
        },
        { status: 409 }
      )
    }

    // Build update object safely
    const updateData: Record<string, any> = {}

    if (status) {
      updateData.status = status as PaymentStatus
    }

    if (reconciled === true) {
      updateData.reconciledAt = new Date()
      updateData.reconciledBy = session.user.id
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No supported fields to update' }, { status: 400 })
    }

    const updatedPayment = await prisma.paymentLog.update({
      where: { id: paymentId },
      data: updateData,
      include: {
        order: {
          select: {
            orderNumber: true,
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json(updatedPayment)
  } catch (error) {
    console.error('Error updating payment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}