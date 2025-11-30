import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for address updates
const UpdateAddressSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  phone: z.string().min(10, 'Phone number must be at least 10 digits').optional(),
  street: z.string().min(1, 'Street address is required').optional(),
  city: z.string().min(1, 'City is required').optional(),
  state: z.string().min(1, 'State is required').optional(),
  pincode: z.string().min(6, 'Pincode must be at least 6 characters').optional(),
  landmark: z.string().optional(),
  type: z.enum(['HOME', 'WORK', 'OTHER']).optional()
})

// GET single address
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const addressId = params.id

    const address = await prisma.address.findUnique({
      where: { id: addressId }
    })

    if (!address) {
      return NextResponse.json(
        { error: 'Address not found' },
        { status: 404 }
      )
    }

    // Verify address belongs to user
    if (address.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(address)
  } catch (error) {
    console.error('Error fetching address:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT update address
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const addressId = params.id
    const body = await request.json()

    // Validate input
    const validationResult = UpdateAddressSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validationResult.error.issues 
        },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Check if address exists and belongs to user
    const existingAddress = await prisma.address.findUnique({
      where: { id: addressId }
    })

    if (!existingAddress) {
      return NextResponse.json(
        { error: 'Address not found' },
        { status: 404 }
      )
    }

    if (existingAddress.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Update address
    const updatedAddress = await prisma.address.update({
      where: { id: addressId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.street !== undefined && { street: data.street }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.state !== undefined && { state: data.state }),
        ...(data.pincode !== undefined && { pincode: data.pincode }),
        ...(data.landmark !== undefined && { landmark: data.landmark }),
        ...(data.type !== undefined && { type: data.type })
      }
    })

    return NextResponse.json(updatedAddress)
  } catch (error) {
    console.error('Error updating address:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE address
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const addressId = params.id

    // Check if address exists and belongs to user
    const existingAddress = await prisma.address.findUnique({
      where: { id: addressId }
    })

    if (!existingAddress) {
      return NextResponse.json(
        { error: 'Address not found' },
        { status: 404 }
      )
    }

    if (existingAddress.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if this address is being used in any pending orders
    const pendingOrdersWithAddress = await prisma.order.findMany({
      where: {
        addressId: addressId,
        status: {
          in: ['PENDING', 'CONFIRMED', 'PROCESSING']
        }
      }
    })

    if (pendingOrdersWithAddress.length > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete address that is associated with pending orders',
          pendingOrders: pendingOrdersWithAddress.length
        },
        { status: 400 }
      )
    }

    // Check if this is the user's default address
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { defaultAddressId: true }
    })

    if (user?.defaultAddressId === addressId) {
      // Clear default address if this address is being deleted
      await prisma.user.update({
        where: { id: session.user.id },
        data: { defaultAddressId: null }
      })
    }

    // Delete address
    await prisma.address.delete({
      where: { id: addressId }
    })

    return NextResponse.json(
      { message: 'Address deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error deleting address:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
