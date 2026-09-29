import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's cart items from MongoDB with product relations
    const cartItems = await prisma.cartItem.findMany({
      where: { userId: session.user.id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            stock: true,
            isActive: true,
            images: true,
            weight: true,
            weightUnit: true
          }
        }
      }
    })

    if (!cartItems || cartItems.length === 0) {
      return NextResponse.json({ items: [], subtotal: 0, shippingFee: 0, total: 0 }, { status: 200 })
    }

    let subtotal = 0
    const verifiedItems = []

    for (const item of cartItems) {
      const product = item.product
      
      // Handle edge cases where a product was deleted or deactivated
      if (!product || !product.isActive) continue

      const itemTotal = product.price * item.quantity
      subtotal += itemTotal

      verifiedItems.push({
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        quantity: item.quantity,
        stock: product.stock,
        images: product.images,
        weight: product.weight,
        weightUnit: product.weightUnit,
        total: itemTotal
      })
    }

    // Server-side shipping rule (e.g., Free over ₹500)
    const shippingFee = subtotal > 500 ? 0 : 50

    // Optional: Fetch active tax configuration
    const taxConfig = await prisma.taxConfiguration.findFirst({
      where: { isActive: true }
    })
    const taxRate = taxConfig ? taxConfig.rate : 0
    const taxAmount = (subtotal * taxRate) / 100

    const total = subtotal + shippingFee + taxAmount

    return NextResponse.json({
      items: verifiedItems,
      subtotal,
      shippingFee,
      taxAmount,
      total,
      itemCount: verifiedItems.reduce((acc, i) => acc + i.quantity, 0)
    })

  } catch (error: any) {
    console.error('Error fetching server cart summary:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}