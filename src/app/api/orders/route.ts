import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateOrderTax } from '@/lib/taxEngine'

// GET user orders
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const orders = await prisma.order.findMany({
      where: { userId: session.user.id },
      include: {
        orderItems: {
          select: {
            id: true,
            name: true,
            quantity: true,
            price: true,
          }
        },
        address: {
          select: {
            name: true,
            street: true,
            city: true,
            state: true,
            pincode: true,
          }
        }
      },
      orderBy: { id: 'desc' }
    })

    return NextResponse.json(orders)
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST create new order
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
    const { items, shippingAddress, billingAddress, paymentMethod, notes, shippingFee = 0 } = body

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Items are required' },
        { status: 400 }
      )
    }

    if (!shippingAddress) {
      return NextResponse.json(
        { error: 'Shipping address is required' },
        { status: 400 }
      )
    }

    // Validate shipping address has required fields for tax calculation
    if (!shippingAddress.state) {
      return NextResponse.json(
        { error: 'Shipping state is required for tax calculation' },
        { status: 400 }
      )
    }

    // Verify product availability and stock, and get product details for tax calculation
    const validatedItems: Array<{
      id: string
      name: string
      price: number
      quantity: number
      category: string
    }> = []
    let subtotal = 0

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: {
          category: true
        }
      })

      if (!product) {
        return NextResponse.json(
          { error: `Product not found: ${item.name}` },
          { status: 400 }
        )
      }

      if (!product.isActive) {
        return NextResponse.json(
          { error: `Product is no longer available: ${item.name}` },
          { status: 400 }
        )
      }

      if (product.stock < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for: ${item.name}` },
          { status: 400 }
        )
      }

      const itemTotal = product.price * item.quantity
      subtotal += itemTotal

      validatedItems.push({
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        category: product.category.name
      })
    }

    // Calculate taxes
    const taxCalculation = await calculateOrderTax({
      items: validatedItems,
      subtotal,
      shippingFee,
      shippingAddress: {
        state: shippingAddress.state,
        city: shippingAddress.city || '',
        pincode: shippingAddress.pincode || ''
      },
      userId: session.user.id
    })

    const totalAmount = taxCalculation.finalTotal

    // Create the order with address and items
    const order = await prisma.$transaction(async (tx) => {
      // Create or find shipping address
      let addressId = shippingAddress.id
      if (!addressId) {
        const createdAddress = await tx.address.create({
          data: {
            userId: session.user.id,
            name: shippingAddress.name,
            phone: shippingAddress.phone,
            street: shippingAddress.street,
            city: shippingAddress.city,
            state: shippingAddress.state,
            pincode: shippingAddress.pincode,
            landmark: shippingAddress.landmark,
            type: shippingAddress.type || 'HOME'
          }
        })
        addressId = createdAddress.id
      }

      // Generate unique order number
      const orderNumber = `ORD${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`

      // Create order with tax information
      const newOrder = await tx.order.create({
        data: {
          orderNumber: orderNumber,
          userId: session.user.id,
          addressId: addressId,
          status: 'PENDING',
          paymentMethod: paymentMethod || 'card',
          paymentStatus: paymentMethod === 'cod' ? 'PENDING' : 'PENDING',
          totalAmount: totalAmount,
          subtotalAmount: subtotal,
          taxAmount: taxCalculation.totalTaxAmount,
          taxBreakdown: taxCalculation.taxBreakdown,
          shippingFee: shippingFee,
          notes: notes || null,
          orderItems: {
            create: validatedItems.map((item) => ({
              productId: item.id,
              name: item.name,
              quantity: item.quantity,
              price: item.price
            }))
          }
        },
        include: {
          orderItems: true,
          address: true
        }
      })

      // Update product stock
      for (const item of validatedItems) {
        await tx.product.update({
          where: { id: item.id },
          data: {
            stock: {
              decrement: item.quantity
            }
          }
        })
      }

      return newOrder
    })

    // Clear user's cart after successful order
    try {
      await prisma.cartItem.deleteMany({
        where: { userId: session.user.id }
      })
    } catch (cartError) {
      console.error('Error clearing cart:', cartError)
      // Don't fail the order if cart clearing fails
    }

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    console.error('Error creating order:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
