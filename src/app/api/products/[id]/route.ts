import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface ProductPageContext {
  params: Promise<{ id: string }>
}

interface TransformedProduct {
  id: string
  name: string
  description: string
  price: number
  compareAt?: number | null
  images: string[]
  categoryId: string
  stock: number
  isActive: boolean
  slug: string
  weight?: number | null
  unit?: string | null
  tags: string[]
  createdAt: Date
  updatedAt: Date
  category?: { name: string; slug: string }
  inStock: boolean
  discountPercent: number
  relatedProducts: any[]
}

export async function GET(
  _request: NextRequest, 
  { params }: ProductPageContext
): Promise<NextResponse> {
  try {
    const { id } = await params
    
    // Check if the id is a valid MongoDB ObjectId (24 hex characters)
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id)
    
    const product = await prisma.product.findFirst({
      where: isObjectId ? { id: id } : { slug: id },
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
    const transformedProduct: TransformedProduct = {
      ...product,
      compareAt: product.compareAtPrice,
      inStock: product.stock > 0,
      discountPercent: product.compareAtPrice 
        ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
        : 0,
      relatedProducts: relatedProducts.map((related: any) => ({
        ...related,
        inStock: related.stock > 0,
        discountPercent: related.compareAtPrice
          ? Math.round(((related.compareAtPrice - related.price) / related.compareAtPrice) * 100)
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
