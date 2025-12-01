import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET single order
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: orderId } = await params

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: session.user.id
      },
      include: {
        orderItems: {
          select: {
            id: true,
            name: true,
            quantity: true,
            price: true,
          }
        },
        address: {
          select: {
            name: true,
            phone: true,
            street: true,
            city: true,
            state: true,
            pincode: true,
          }
        },
        paymentLogs: {
          select: {
            id: true,
            status: true,
            method: true,
            razorpayOrderId: true,
            razorpayPaymentId: true,
            failureReason: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(order)
  } catch (error) {
    console.error('Error fetching order:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
