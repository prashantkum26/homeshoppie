import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const EXPIRY_MINUTES = 30

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')

  if (!secret) {
    return NextResponse.json({ error: 'Cron endpoint is not configured' }, { status: 503 })
  }

  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - EXPIRY_MINUTES * 60 * 1000)
  const expiredOrders = await prisma.order.findMany({
    where: {
      status: 'PENDING',
      paymentStatus: { in: ['PENDING', 'AUTHORIZED'] },
      createdAt: { lt: cutoff },
    },
    select: {
      id: true,
      orderItems: {
        select: { productId: true, quantity: true },
      },
    },
    take: 100,
  })

  let released = 0

  for (const order of expiredOrders) {
    const releasedOrder = await prisma.$transaction(async (tx) => {
      const orderUpdate = await tx.order.updateMany({
        where: {
          id: order.id,
          status: 'PENDING',
          paymentStatus: { in: ['PENDING', 'AUTHORIZED'] },
        },
        data: {
          status: 'CANCELLED',
          paymentStatus: 'CANCELLED',
          cancelReason: 'Payment window expired',
          cancelledAt: new Date(),
          updatedAt: new Date(),
        },
      })

      if (orderUpdate.count !== 1) return false

      for (const item of order.orderItems) {
        await tx.product.updateMany({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        })
      }

      await tx.paymentLog.updateMany({
        where: {
          orderId: order.id,
          status: { in: ['PENDING', 'AUTHORIZED'] },
        },
        data: {
          status: 'CANCELLED',
          failureReason: 'Payment window expired',
          updatedAt: new Date(),
        },
      })

      return true
    })

    if (releasedOrder) released += 1
  }

  return NextResponse.json({ released, checked: expiredOrders.length })
}
