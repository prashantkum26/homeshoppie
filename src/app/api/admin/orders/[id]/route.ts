import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logSecurityEvent, getClientIP } from '@/lib/security'

// GET single order (admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ipAddress = getClientIP(request)
  const { id: orderId } = await params
  
  try {
    const session = await auth()

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      await logSecurityEvent({
        action: 'UNAUTHORIZED_ACCESS',
        ipAddress,
        severity: 'HIGH',
        details: { endpoint: `/api/admin/orders/${orderId}`, reason: 'Non-admin access attempt' },
        blocked: true
      })
      
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        address: true,
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true
              }
            }
          }
        },
        paymentLogs: {
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

    // Log admin access
    await logSecurityEvent({
      userId: session.user.id,
      action: 'API_ACCESS',
      ipAddress,
      severity: 'LOW',
      details: {
        endpoint: `/api/admin/orders/${orderId}`,
        action: 'order_viewed',
        order_number: order.orderNumber
      }
    })

    return NextResponse.json(order)
  } catch (error: any) {
    console.error('Error fetching order for admin:', error)
    
    const session = await auth()
    const logData: any = {
      action: 'API_ACCESS',
      ipAddress,
      severity: 'HIGH',
      details: {
        endpoint: `/api/admin/orders/${orderId}`,
        error: error.message,
        action: 'order_fetch_failed'
      }
    }
    
    if (session?.user?.id) {
      logData.userId = session.user.id
    }
    
    await logSecurityEvent(logData)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH update order status (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ipAddress = getClientIP(request)
  const { id: orderId } = await params
  
  try {
    const session = await auth()

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      await logSecurityEvent({
        action: 'UNAUTHORIZED_ACCESS',
        ipAddress,
        severity: 'HIGH',
        details: { endpoint: `/api/admin/orders/${orderId}`, reason: 'Non-admin access attempt' },
        blocked: true
      })
      
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { status, notes } = body

    // Validate status
    const validStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status provided' },
        { status: 400 }
      )
    }

    // Get current order
    const currentOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: { 
        id: true, 
        status: true, 
        orderNumber: true,
        notes: true,
        user: {
          select: { email: true, name: true }
        }
      }
    })

    if (!currentOrder) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status,
        notes: notes || currentOrder.notes,
        updatedAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        orderItems: true
      }
    })

    // Log the status change
    await logSecurityEvent({
      userId: session.user.id,
      action: 'API_ACCESS',
      ipAddress,
      severity: 'LOW',
      details: {
        endpoint: `/api/admin/orders/${orderId}`,
        action: 'order_status_updated',
        order_number: currentOrder.orderNumber,
        old_status: currentOrder.status,
        new_status: status,
        admin_email: session.user.email
      }
    })

    // TODO: Send notification to customer about status change
    // This could be email, SMS, or push notification

    return NextResponse.json(updatedOrder)
  } catch (error: any) {
    console.error('Error updating order status:', error)
    
    const session = await auth()
    const logData: any = {
      action: 'API_ACCESS',
      ipAddress,
      severity: 'HIGH',
      details: {
        endpoint: `/api/admin/orders/${orderId}`,
        error: error.message,
        action: 'order_update_failed'
      }
    }
    
    if (session?.user?.id) {
      logData.userId = session.user.id
    }
    
    await logSecurityEvent(logData)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
