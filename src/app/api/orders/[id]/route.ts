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
        orderItems: true,
        address: true,
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

// PATCH update order - SECURE VERSION (Limited Updates Only)
export async function PATCH(
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
    const body = await request.json()
    
    // 🔒 SECURITY: Only allow updating safe, non-critical fields
    // Payment status and order status are FORBIDDEN from client-side updates
    const { notes, specialInstructions } = body

    // Reject any attempt to update critical fields
    if (body.paymentStatus || body.status || body.totalAmount || body.paymentIntentId) {
      console.warn(`Security: Attempted unauthorized field update by user ${session.user.id}`, {
        orderId,
        attemptedFields: Object.keys(body),
        userAgent: request.headers.get('user-agent')
      })
      
      return NextResponse.json(
        { error: 'Unauthorized: Cannot update protected fields' },
        { status: 403 }
      )
    }

    // Verify order belongs to user
    const existingOrder = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: session.user.id
      }
    })

    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // 🔒 SECURITY: Only allow orders in certain states to be updated by users
    // Prevent updates to completed/shipped orders
    if (['DELIVERED', 'CANCELLED', 'REFUNDED'].includes(existingOrder.status)) {
      return NextResponse.json(
        { error: 'Cannot update order in current state' },
        { status: 400 }
      )
    }

    // Update only safe fields
    const updateData: any = { updatedAt: new Date() }
    if (notes !== undefined) updateData.notes = notes
    if (specialInstructions !== undefined) updateData.specialInstructions = specialInstructions

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        orderItems: true,
        address: true,
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

    return NextResponse.json(updatedOrder)
  } catch (error) {
    console.error('Error updating order:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
