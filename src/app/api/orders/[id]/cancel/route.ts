import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isSameOriginRequest } from '@/lib/security'
import { canCancelOrder } from '@/lib/order-state'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: orderId } = await params
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId: session.user.id,
    },
    select: {
      id: true,
      status: true,
      fulfillmentStatus: true,
      paymentStatus: true,
      orderItems: {
        select: {
          productId: true,
          quantity: true,
        },
      },
    },
  })

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (!canCancelOrder(order.status, order.fulfillmentStatus)) {
    return NextResponse.json({
      cancelled: false,
      code: 'ORDER_ALREADY_SHIPPED',
      message: 'This order cannot be cancelled after shipping has started.',
    }, { status: 409 })
  }

  // A dismissal cannot prove that no payment was made. Never cancel an order
  // after the gateway has authorized or captured a payment.
  if (order.status !== 'PENDING' || order.paymentStatus !== 'PENDING') {
    return NextResponse.json({
      cancelled: false,
      paymentStatus: order.paymentStatus,
      message: 'Payment is being processed. The order was not cancelled.',
    })
  }

  const cancelled = await prisma.$transaction(async (tx) => {
    const update = await tx.order.updateMany({
      where: {
        id: order.id,
        userId: session.user.id,
        status: 'PENDING',
        paymentStatus: 'PENDING',
      },
      data: {
        status: 'CANCELLED',
        paymentStatus: 'CANCELLED',
        cancelReason: 'Payment modal dismissed',
        cancelledAt: new Date(),
        cancelledBy: session.user.id,
        updatedAt: new Date(),
      },
    })

    if (update.count !== 1) {
      return false
    }

    for (const item of order.orderItems) {
      await tx.product.updateMany({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      })
    }

    await tx.paymentLog.updateMany({
      where: {
        orderId: order.id,
        status: 'PENDING',
      },
      data: {
        status: 'CANCELLED',
        failureReason: 'Payment modal dismissed',
        updatedAt: new Date(),
      },
    })

    return true
  })

  return NextResponse.json({
    cancelled,
    message: cancelled
      ? 'Order cancelled and reserved stock released.'
      : 'Payment is being processed. The order was not cancelled.',
  })
}
