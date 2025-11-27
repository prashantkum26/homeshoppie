import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request, { params }) {
  try {
    const { id } = params
    
    const product = await prisma.product.findUnique({
      where: { 
        OR: [
          { id: id },
          { slug: id }
        ]
      },
      include: {
        category: {
          select: { name: true, slug: true }
        }
      }
    })

    if (!product || !product.isActive) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Get related products from the same category
    const relatedProducts = await prisma.product.findMany({
      where: {
        categoryId: product.categoryId,
        id: { not: product.id },
        isActive: true,
        stock: { gt: 0 }
      },
      take: 4,
      orderBy: { createdAt: 'desc' }
    })

    // Transform product to include computed fields
    const transformedProduct = {
      ...product,
      inStock: product.stock > 0,
      discountPercent: product.compareAt 
        ? Math.round(((product.compareAt - product.price) / product.compareAt) * 100)
        : 0,
      relatedProducts: relatedProducts.map(related => ({
        ...related,
        inStock: related.stock > 0,
        discountPercent: related.compareAt 
          ? Math.round(((related.compareAt - related.price) / related.compareAt) * 100)
          : 0
      }))
    }

    return NextResponse.json(transformedProduct)
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    )
  }
}
