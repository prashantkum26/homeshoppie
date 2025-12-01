import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET user addresses
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const addresses = await prisma.address.findMany({
      where: { userId: session.user.id }
    })

    return NextResponse.json(addresses)
  } catch (error) {
    console.error('Error fetching addresses:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST create new address
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, phone, street, city, state, pincode, landmark, type, isDefault = false } = body

    // Validate required fields
    if (!name || !phone || !street || !city || !state || !pincode) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check address limit (max 5 addresses per user)
    const existingAddressCount = await prisma.address.count({
      where: { userId: session.user.id }
    })

    if (existingAddressCount >= 5) {
      return NextResponse.json(
        { 
          error: 'Address limit reached. You can have a maximum of 5 addresses.',
          currentCount: existingAddressCount,
          maxAllowed: 5
        },
        { status: 400 }
      )
    }

    // Validate input data
    if (phone.length < 10) {
      return NextResponse.json(
        { error: 'Phone number must be at least 10 digits' },
        { status: 400 }
      )
    }

    if (pincode.length < 6) {
      return NextResponse.json(
        { error: 'Pincode must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Create address and handle default address logic
    const result = await prisma.$transaction(async (tx: any) => {
      // If this is set as default or user has no addresses, make it default
      const shouldSetAsDefault = isDefault || existingAddressCount === 0

      // Create the address
      const address = await tx.address.create({
        data: {
          userId: session.user.id,
          name,
          phone,
          street,
          city,
          state,
          pincode,
          landmark: landmark || "",
          type: type || 'HOME'
        }
      })

      // Update user's default address if needed
      if (shouldSetAsDefault) {
        await tx.user.update({
          where: { id: session.user.id },
          data: { defaultAddressId: address.id }
        })
      }

      return { address, isDefault: shouldSetAsDefault }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error creating address:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
