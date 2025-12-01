import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logSecurityEvent, getClientIP } from '@/lib/security'

// GET all orders (admin only)
export async function GET(request: NextRequest) {
  const ipAddress = getClientIP(request)
  
  try {
    const session = await auth()

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      await logSecurityEvent({
        action: 'UNAUTHORIZED_ACCESS',
        ipAddress,
        severity: 'HIGH',
        details: { endpoint: '/api/admin/orders', reason: 'Non-admin access attempt' },
        blocked: true
      })
      
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const orders = await prisma.order.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        address: {
          select: {
            name: true,
            street: true,
            city: true,
            state: true,
            pincode: true
          }
        },
        orderItems: {
          select: {
            id: true,
            name: true,
            quantity: true,
            price: true,
            product: {
              select: {
                id: true,
                name: true
              }
            }
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
      },
      orderBy: { createdAt: 'desc' }
    })

    // Log admin access
    await logSecurityEvent({
      userId: session.user.id,
      action: 'API_ACCESS',
      ipAddress,
      severity: 'LOW',
      details: {
        endpoint: '/api/admin/orders',
        action: 'orders_fetched',
        count: orders.length
      }
    })

    return NextResponse.json(orders)
  } catch (error: any) {
    console.error('Error fetching orders for admin:', error)
    
    // Log the error
    const session = await auth()
    const logData: any = {
      action: 'API_ACCESS',
      ipAddress,
      severity: 'HIGH',
      details: {
        endpoint: '/api/admin/orders',
        error: error.message,
        action: 'orders_fetch_failed'
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
