import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PaymentStatus } from '@prisma/client'

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

    // Build update object safely
    const updateData: Record<string, any> = {}
    
    if (status) {
      updateData.status = status as PaymentStatus
    }

    if (reconciled === true) {
      updateData.reconciledAt = new Date()
      updateData.reconciledBy = session.user.id
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