import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for address updates
const UpdateAddressSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  phone: z.string().min(10, 'Phone number must be at least 10 digits').optional(),
  street1: z.string().min(1, 'Street address is required').optional(),
  street2: z.string().optional(),
  city: z.string().min(1, 'City is required').optional(),
  state: z.string().min(1, 'State is required').optional(),
  postalCode: z.string().min(6, 'Postal code must be at least 6 characters').optional(),
  landmark: z.string().optional(),
  type: z.enum(['HOME', 'WORK', 'OTHER']).optional(),
  isDefault: z.boolean().optional()
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

    const { id: addressId } = await params;

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

    const {id: addressId} = await params
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

    // Update address and handle default address logic
    const result = await prisma.$transaction(async (tx: any) => {
      // Update address
      const updatedAddress = await tx.address.update({
        where: { id: addressId },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.phone !== undefined && { phone: data.phone }),
          ...(data.street1 !== undefined && { street1: data.street1 }),
          ...(data.street2 !== undefined && { street2: data.street2 }),
          ...(data.city !== undefined && { city: data.city }),
          ...(data.state !== undefined && { state: data.state }),
          ...(data.postalCode !== undefined && { postalCode: data.postalCode }),
          ...(data.landmark !== undefined && { landmark: data.landmark }),
          ...(data.type !== undefined && { type: data.type })
        }
      })

      // Handle default address update
      if (data.isDefault !== undefined) {
        if (data.isDefault) {
          // Set as default address
          await tx.user.update({
            where: { id: session.user.id },
            data: { defaultAddressId: addressId }
          })
        } else {
          // Remove as default if currently default
          const user = await tx.user.findUnique({
            where: { id: session.user.id },
            select: { defaultAddressId: true }
          })
          if (user?.defaultAddressId === addressId) {
            await tx.user.update({
              where: { id: session.user.id },
              data: { defaultAddressId: null }
            })
          }
        }
      }

      return updatedAddress
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error updating address:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH update address (partial updates)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {id: addressId} = await params
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

    // Build update data object only with provided fields
    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.street1 !== undefined) updateData.street1 = data.street1
    if (data.street2 !== undefined) updateData.street2 = data.street2
    if (data.city !== undefined) updateData.city = data.city
    if (data.state !== undefined) updateData.state = data.state
    if (data.postalCode !== undefined) updateData.postalCode = data.postalCode
    if (data.landmark !== undefined) updateData.landmark = data.landmark
    if (data.type !== undefined) updateData.type = data.type

    // Update address and handle default address logic
    const result = await prisma.$transaction(async (tx: any) => {
      let updatedAddress = existingAddress

      // Only update if there are fields to update
      if (Object.keys(updateData).length > 0) {
        updatedAddress = await tx.address.update({
          where: { id: addressId },
          data: updateData
        })
      }

      // Handle default address update
      if (data.isDefault !== undefined) {
        if (data.isDefault) {
          // Set as default address
          await tx.user.update({
            where: { id: session.user.id },
            data: { defaultAddressId: addressId }
          })
        } else {
          // Remove as default if currently default
          const user = await tx.user.findUnique({
            where: { id: session.user.id },
            select: { defaultAddressId: true }
          })
          if (user?.defaultAddressId === addressId) {
            await tx.user.update({
              where: { id: session.user.id },
              data: { defaultAddressId: null }
            })
          }
        }
      }

      return updatedAddress
    })

    return NextResponse.json(result)
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

    const { id: addressId } = await params

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
