import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for setting default address
const SetDefaultAddressSchema = z.object({
  addressId: z.string().min(1, 'Address ID is required')
})

// GET current default address
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user with default address
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        id: true,
        defaultAddressId: true
      }
    })

    if (!user?.defaultAddressId) {
      return NextResponse.json({ defaultAddress: null })
    }

    // Get the default address details
    const defaultAddress = await prisma.address.findUnique({
      where: { id: user.defaultAddressId }
    })

    if (!defaultAddress || defaultAddress.userId !== session.user.id) {
      // Clear invalid default address reference
      await prisma.user.update({
        where: { id: session.user.id },
        data: { defaultAddressId: null }
      })
      
      return NextResponse.json({ defaultAddress: null })
    }

    return NextResponse.json({ 
      defaultAddress,
      defaultAddressId: user.defaultAddressId
    })
  } catch (error) {
    console.error('Error fetching default address:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT set default address
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Validate input
    const validationResult = SetDefaultAddressSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validationResult.error.issues 
        },
        { status: 400 }
      )
    }

    const { addressId } = validationResult.data

    // Verify address exists and belongs to user
    const address = await prisma.address.findUnique({
      where: { id: addressId }
    })

    if (!address) {
      return NextResponse.json(
        { error: 'Address not found' },
        { status: 404 }
      )
    }

    if (address.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Address does not belong to you' },
        { status: 403 }
      )
    }

    // Update user's default address
    await prisma.user.update({
      where: { id: session.user.id },
      data: { defaultAddressId: addressId }
    })

    return NextResponse.json({ 
      message: 'Default address updated successfully',
      defaultAddressId: addressId,
      address
    })
  } catch (error) {
    console.error('Error setting default address:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE clear default address
export async function DELETE() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Clear user's default address
    await prisma.user.update({
      where: { id: session.user.id },
      data: { defaultAddressId: null }
    })

    return NextResponse.json({ 
      message: 'Default address cleared successfully',
      defaultAddressId: null
    })
  } catch (error) {
    console.error('Error clearing default address:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
