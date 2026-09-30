import { NextRequest, NextResponse } from 'next/server'
import { auth, hasVerifiedContact } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateOrderTax } from '@/lib/taxEngine'
import { isSameOriginRequest } from '@/lib/security'
import {
  getPaymentMethodAvailability,
  isPaymentMethodValue,
  describePaymentMethodUnavailability,
  getAvailablePaymentMethods,
  toPublicPaymentMethod
} from '@/lib/payment-methods'

// GET user orders
export async function GET() {
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
        orderItems: true,
        address: true
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
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
    }

    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!(await hasVerifiedContact(session.user.id))) {
      return NextResponse.json(
        { error: 'Email and required contact verification must be completed before checkout.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { items, shippingAddress, paymentMethod, notes } = body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Items are required' },
        { status: 400 }
      )
    }

    // Shape check only. Availability is re-validated below against the
    // server-computed total, since limits depend on the order value.
    if (!isPaymentMethodValue(paymentMethod)) {
      return NextResponse.json(
        { error: 'Invalid payment method', code: 'INVALID_PAYMENT_METHOD' },
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
        { error: 'Shipping state is required.' },
        { status: 400 }
      )
    }

    const recentDuplicate = await prisma.order.findFirst({
      where: {
        userId: session.user.id,
        status: 'PENDING',
        createdAt: {
          gte: new Date(Date.now() - 10000) // Last 10 seconds
        }
      }
    })

    if (recentDuplicate) {
      return NextResponse.json(
        { error: 'An order is already being processed. Please wait.' },
        { status: 400 }
      )
    }

    type RequestedItem = { productId: string; quantity: number }
    const normalizedItems = new Map<string, number>()

    for (const item of items as unknown[]) {
      if (!item || typeof item !== 'object') {
        return NextResponse.json({ error: 'Invalid order item' }, { status: 400 })
      }

      const requestedItem = item as Partial<RequestedItem>
      const productId = requestedItem.productId
      const quantity = requestedItem.quantity
      if (
        typeof productId !== 'string' ||
        !/^[a-fA-F0-9]{24}$/.test(productId) ||
        typeof quantity !== 'number' ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        quantity > 100
      ) {
        return NextResponse.json(
          { error: 'Each item must have a valid product and quantity between 1 and 100.' },
          { status: 400 }
        )
      }

      normalizedItems.set(
        productId,
        (normalizedItems.get(productId) || 0) + quantity
      )
    }

    const validatedItems: Array<{
      id: string
      name: string
      price: number
      quantity: number
      category: string
    }> = []

    for (const [productId, quantity] of Array.from(normalizedItems.entries())) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          category: true
        }
      })

      if (!product) {
        return NextResponse.json(
          { error: `Product not found: ${productId}` },
          { status: 400 }
        )
      }

      if (!product.isActive) {
        return NextResponse.json(
          { error: `Product is no longer available: ${product.name}` },
          { status: 400 }
        )
      }

      if (product.stock < quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for: ${product.name}` },
          { status: 400 }
        )
      }

      validatedItems.push({
        id: product.id,
        name: product.name,
        price: product.price,
        quantity,
        category: product.category.name
      })
    }

    const subtotal = Number(validatedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0).toFixed(2));

    const shippingFee = subtotal > 500 ? 0 : 50;

    // Calculate taxes
    const taxCalculation = await calculateOrderTax({
      items: validatedItems,
      subtotal,
      shippingFee,
      shippingAddress: {
        state: shippingAddress.state,
        city: shippingAddress.city || '',
        postalCode: shippingAddress.postalCode || ''
      },
      userId: session.user.id
    })

    const totalAmount = Number(taxCalculation.finalTotal.toFixed(2))

    // Authoritative availability check against the server-computed total.
    // The client's list may be stale (method disabled, or cart value grew
    // past a method limit), so this must run before any order row exists.
    const methodAvailability = getPaymentMethodAvailability(paymentMethod, totalAmount)

    if (!methodAvailability.available) {
      return NextResponse.json(
        {
          error: describePaymentMethodUnavailability(methodAvailability.reason),
          code: 'PAYMENT_METHOD_UNAVAILABLE',
          reason: methodAvailability.reason,
          availablePaymentMethods: getAvailablePaymentMethods(totalAmount).map(toPublicPaymentMethod)
        },
        { status: 409 }
      )
    }

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
            street1: shippingAddress.street1,
            street2: shippingAddress.street2 || '',
            city: shippingAddress.city,
            state: shippingAddress.state,
            postalCode: shippingAddress.postalCode,
            landmark: shippingAddress.landmark || '',
            type: shippingAddress.type || 'HOME'
          }
        })

        addressId = createdAddress.id
      } else {
        const existingAddress = await tx.address.findFirst({
          where: { id: shippingAddress.id, userId: session.user.id },
          select: { id: true }
        })

        if (!existingAddress) {
          throw new Error('Invalid shipping address')
        }

        addressId = existingAddress.id
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
          paymentMethod: paymentMethod,
          paymentStatus: 'PENDING',
          totalAmount: totalAmount,
          subtotalAmount: subtotal,
          taxAmount: taxCalculation.totalTaxAmount,
          taxBreakdown: JSON.stringify(taxCalculation.taxBreakdown),
          shippingFee: shippingFee,
          notes: notes || null
        },
        include: {
          orderItems: true,
          address: true
        }
      })

      // Create order items separately with required fields
      for (const item of validatedItems) {
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: item.id,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            totalPrice: item.price * item.quantity
          }
        })
      }

      // Reserve inventory atomically. The conditional stock predicate prevents
      // overselling when concurrent checkouts target the same product.
      for (const item of validatedItems) {
        const reservation = await tx.product.updateMany({
          where: {
            id: item.id,
            isActive: true,
            stock: { gte: item.quantity },
          },
          data: {
            stock: {
              decrement: item.quantity
            }
          }
        })

        if (reservation.count !== 1) {
          throw new Error(`Insufficient stock for product ${item.id}`)
        }
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
    if (error instanceof Error && error.message.startsWith('Insufficient stock for product')) {
      return NextResponse.json(
        { error: 'One or more products became unavailable. Please review your cart and try again.' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
