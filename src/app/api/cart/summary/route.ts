import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateOrderTax } from '@/lib/taxEngine'
import { getAvailablePaymentMethods, toPublicPaymentMethod } from '@/lib/payment-methods'

export async function GET(_request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Fetch user's cart items with product and category relations
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
            weightUnit: true,
            category: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })

    if (!cartItems || cartItems.length === 0) {
      return NextResponse.json({ 
        items: [], 
        subtotal: 0, 
        shippingFee: 0, 
        taxAmount: 0, 
        total: 0, 
        itemCount: 0,
        paymentMethods: []
      }, { status: 200 })
    }

    let subtotal = 0
    const verifiedItems = []

    for (const item of cartItems) {
      const product = item.product
      
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
        category: product.category?.name || 'General',
        total: itemTotal
      })
    }

    // 2. Fetch user's default shipping address for location-based tax rules
    const userAddress = await prisma.address.findFirst({
      where: { 
        userId: session.user.id,
        deletedAt: null
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    // Fallback address if none saved yet
    const shippingAddress = {
      state: userAddress?.state || 'Bihar',
      city: userAddress?.city || '',
      postalCode: userAddress?.postalCode || ''
    }

    // Server-side shipping rule (Free over ₹500)
    const shippingFee = subtotal > 500 ? 0 : 50

    // 3. Compute dynamic taxes using your bulletproof TaxEngine
    const taxCalculation = await calculateOrderTax({
      items: verifiedItems,
      subtotal,
      shippingFee,
      shippingAddress,
      userId: session.user.id
    })

    return NextResponse.json({
      items: verifiedItems,
      subtotal: taxCalculation.subtotal,
      shippingFee,
      taxAmount: taxCalculation.totalTaxAmount,
      taxBreakdown: taxCalculation.taxBreakdown,
      total: taxCalculation.finalTotal,
      itemCount: verifiedItems.reduce((acc, i) => acc + i.quantity, 0),
      // Resolved against the server-computed total so the checkout UI can
      // never offer a method that order creation would reject.
      paymentMethods: getAvailablePaymentMethods(taxCalculation.finalTotal).map(toPublicPaymentMethod)
    })

  } catch (error: any) {
    console.error('Error fetching server cart summary:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}