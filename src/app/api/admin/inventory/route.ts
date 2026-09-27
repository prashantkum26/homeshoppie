import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        lowStockThreshold: true,
        isActive: true,
        price: true,
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(products)
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { productId, type, quantityChange, notes } = await request.json()

    if (!productId || !type || quantityChange === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Use a transaction to ensure stock is updated AND log is created atomically
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch current stock to calculate accurately
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { stock: true }
      })

      if (!product) throw new Error('Product not found')

      const oldStock = product.stock
      const newStock = oldStock + quantityChange

      // 2. Update product stock
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: { stock: newStock }
      })

      // 3. Create InventoryLog audit entry
      await tx.inventoryLog.create({
        data: {
          productId,
          type,
          quantity: Math.abs(quantityChange), // store absolute quantity of movement
          oldStock,
          newStock,
          notes,
          createdBy: session.user.id
        }
      })

      return updatedProduct
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Inventory adjust error:', error)
    return NextResponse.json({ error: 'Failed to adjust inventory' }, { status: 500 })
  }
}