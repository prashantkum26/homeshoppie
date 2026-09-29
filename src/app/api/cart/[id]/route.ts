import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

/**
 * PATCH /api/cart/:id
 *
 * Update quantity of one CartItem.
 *
 * IMPORTANT:
 * :id = CartItem.id
 * NOT Product.id
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: cartItemId } = await params

    if (!cartItemId) {
      return NextResponse.json(
        { error: 'Cart item ID is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const quantity = body?.quantity

    if (
      typeof quantity !== 'number' ||
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      return NextResponse.json(
        {
          error: 'Quantity must be a positive integer',
        },
        { status: 400 }
      )
    }

    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        userId: session.user.id,
      },
      include: {
        product: true,
      },
    })

    if (!cartItem) {
      return NextResponse.json(
        { error: 'Cart item not found' },
        { status: 404 }
      )
    }

    const product = cartItem.product

    if (
      product.trackInventory &&
      !product.allowBackorder &&
      quantity > product.stock
    ) {
      return NextResponse.json(
        {
          error: 'Insufficient stock available',
          availableStock: product.stock,
        },
        { status: 400 }
      )
    }

    const updatedCartItem = await prisma.cartItem.update({
      where: {
        id: cartItemId,
      },
      data: {
        quantity,
        priceSnapshot: product.price,
        deletedAt: null,
      },
      include: {
        product: {
          include: {
            category: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json(updatedCartItem)
  } catch (error) {
    console.error('PATCH /api/cart/[id] error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/cart/:id
 *
 * Remove ONE CartItem.
 *
 * IMPORTANT:
 * :id = CartItem.id
 * NOT Product.id
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: cartItemId } = await params

    if (!cartItemId) {
      return NextResponse.json(
        { error: 'Cart item ID is required' },
        { status: 400 }
      )
    }

    const deletedCartItem = await prisma.cartItem.deleteMany({
      where: {
        id: cartItemId,
        userId: session.user.id,
      },
    })

    if (deletedCartItem.count === 0) {
      return NextResponse.json(
        { error: 'Cart item not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      message: 'Item removed from cart successfully',
    })
  } catch (error) {
    console.error('DELETE /api/cart/[id] error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}