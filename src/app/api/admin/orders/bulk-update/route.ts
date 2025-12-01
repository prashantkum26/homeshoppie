import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logSecurityEvent, getClientIP } from '@/lib/security'

// PATCH bulk update order statuses (admin only)
export async function PATCH(request: NextRequest) {
  const ipAddress = getClientIP(request)
  
  try {
    const session = await auth()

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      await logSecurityEvent({
        action: 'UNAUTHORIZED_ACCESS',
        ipAddress,
        severity: 'HIGH',
        details: { endpoint: '/api/admin/orders/bulk-update', reason: 'Non-admin access attempt' },
        blocked: true
      })
      
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { orderIds, status, notes } = body

    // Validate input
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json(
        { error: 'Order IDs array is required' },
        { status: 400 }
      )
    }

    if (orderIds.length > 100) {
      return NextResponse.json(
        { error: 'Cannot update more than 100 orders at once' },
        { status: 400 }
      )
    }

    // Validate status
    const validStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status provided' },
        { status: 400 }
      )
    }

    // Get existing orders to log the changes
    const existingOrders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { 
        id: true, 
        orderNumber: true, 
        status: true,
        user: {
          select: { email: true, name: true }
        }
      }
    })

    if (existingOrders.length === 0) {
      return NextResponse.json(
        { error: 'No orders found with provided IDs' },
        { status: 404 }
      )
    }

    // Perform bulk update
    const updateResult = await prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: {
        status,
        ...(notes && { notes }),
        updatedAt: new Date()
      }
    })

    // Log the bulk update action
    await logSecurityEvent({
      userId: session.user.id,
      action: 'API_ACCESS',
      ipAddress,
      severity: 'MEDIUM',
      details: {
        endpoint: '/api/admin/orders/bulk-update',
        action: 'bulk_order_status_updated',
        new_status: status,
        orders_affected: updateResult.count,
        order_numbers: existingOrders.map(o => o.orderNumber),
        admin_email: session.user.email
      }
    })

    // Log individual order changes for audit trail
    for (const order of existingOrders) {
      if (order.status !== status) {
        await logSecurityEvent({
          userId: session.user.id,
          action: 'API_ACCESS',
          ipAddress,
          severity: 'LOW',
          details: {
            endpoint: '/api/admin/orders/bulk-update',
            action: 'order_status_updated',
            order_number: order.orderNumber,
            old_status: order.status,
            new_status: status,
            admin_email: session.user.email,
            bulk_operation: true
          }
        })
      }
    }

    // TODO: Send bulk notifications to customers about status changes
    // This could be queued for batch email/SMS processing

    return NextResponse.json({
      success: true,
      updated: updateResult.count,
      orders: existingOrders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        oldStatus: order.status,
        newStatus: status
      }))
    })

  } catch (error: any) {
    console.error('Error bulk updating orders:', error)
    
    const session = await auth()
    const logData: any = {
      action: 'API_ACCESS',
      ipAddress,
      severity: 'HIGH',
      details: {
        endpoint: '/api/admin/orders/bulk-update',
        error: error.message,
        action: 'bulk_update_failed'
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
