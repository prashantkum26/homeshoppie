import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/cart
 *
 * Get the authenticated user's cart.
 */
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const cartItems = await prisma.cartItem.findMany({
      where: {
        userId: session.user.id,
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
      orderBy: {
        createdAt: 'asc',
      },
    })

    return NextResponse.json(cartItems)
  } catch (error) {
    console.error('GET /api/cart error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cart
 *
 * Add a product to the authenticated user's cart.
 *
 * If the product already exists:
 *   quantity is incremented.
 *
 * If it doesn't exist:
 *   a new CartItem is created.
 */
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

    const productId = body?.productId
    const quantity = body?.quantity

    if (
      typeof productId !== 'string' ||
      !productId.trim()
    ) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      )
    }

    if (
      typeof quantity !== 'number' ||
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      return NextResponse.json(
        { error: 'Quantity must be a positive integer' },
        { status: 400 }
      )
    }

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        isActive: true
      },
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    if (
      product.trackInventory &&
      !product.allowBackorder &&
      quantity > product.stock
    ) {
      return NextResponse.json(
        { error: 'Insufficient stock available' },
        { status: 400 }
      )
    }

    const existingCartItem = await prisma.cartItem.findFirst({
      where: {
        userId: session.user.id,
        productId,
      },
    })

    let cartItem

    if (existingCartItem) {
      const newQuantity = existingCartItem.quantity + quantity

      if (
        product.trackInventory &&
        !product.allowBackorder &&
        newQuantity > product.stock
      ) {
        return NextResponse.json(
          {
            error: 'Insufficient stock available',
            availableStock: product.stock,
          },
          { status: 400 }
        )
      }

      cartItem = await prisma.cartItem.update({
        where: {
          id: existingCartItem.id,
        },
        data: {
          quantity: newQuantity,
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
    } else {
      cartItem = await prisma.cartItem.create({
        data: {
          userId: session.user.id,
          productId,
          quantity,
          priceSnapshot: product.price,
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
    }

    return NextResponse.json(cartItem, {
      status: existingCartItem ? 200 : 201,
    })
  } catch (error) {
    console.error('POST /api/cart error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/cart
 *
 * Clear the authenticated user's entire cart.
 */
export async function DELETE() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    await prisma.cartItem.deleteMany({
      where: {
        userId: session.user.id,
      },
    })

    return NextResponse.json({
      message: 'Cart cleared successfully',
    })
  } catch (error) {
    console.error('DELETE /api/cart error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}