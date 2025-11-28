import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH update cart item quantity
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const cartItemId = params.id
    const body = await request.json()
    const { quantity } = body

    if (!quantity || quantity < 1) {
      return NextResponse.json(
        { error: 'Quantity must be at least 1' },
        { status: 400 }
      )
    }

    // Verify cart item belongs to user
    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        userId: session.user.id
      },
      include: {
        product: true
      }
    })

    if (!cartItem) {
      return NextResponse.json(
        { error: 'Cart item not found' },
        { status: 404 }
      )
    }

    // Check stock availability
    if (quantity > cartItem.product.stock) {
      return NextResponse.json(
        { error: 'Insufficient stock available' },
        { status: 400 }
      )
    }

    const updatedCartItem = await prisma.cartItem.update({
      where: { id: cartItemId },
      data: { quantity },
      include: {
        product: {
          include: {
            category: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json(updatedCartItem)
  } catch (error) {
    console.error('Error updating cart item:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE remove item from cart
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const cartItemId = params.id

    // Verify cart item belongs to user and delete
    const deletedCartItem = await prisma.cartItem.deleteMany({
      where: {
        id: cartItemId,
        userId: session.user.id
      }
    })

    if (deletedCartItem.count === 0) {
      return NextResponse.json(
        { error: 'Cart item not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: 'Item removed from cart successfully' })
  } catch (error) {
    console.error('Error removing cart item:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
