import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { PaginatedResponse, Product } from '@/types'

interface ProductWithCategory {
  id: string
  name: string
  slug: string
  description: string | null
  price: number
  compareAt?: number | null
  originalPrice: number | null
  stock: number
  sku: string | null
  images: string[]
  categoryId: string
  featured: boolean
  createdAt: Date
  updatedAt: Date
  category: {
    name: string
    slug: string
  }
  inStock: boolean
  discountPercent: number
}

export async function GET(request: NextRequest): Promise<NextResponse<PaginatedResponse<ProductWithCategory> | { error: string }>> {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const categoryId = searchParams.get('categoryId')
    const categorySlug = searchParams.get('categorySlug')
    const sortBy = searchParams.get('sortBy') || 'name'
    const sortOrder = searchParams.get('sortOrder') || 'asc'
    const inStockOnly = searchParams.get('inStockOnly') === 'true'
    const minPriceParam = searchParams.get('minPrice')
    const maxPriceParam = searchParams.get('maxPrice')
    const pageParam = searchParams.get('page')
    const limitParam = searchParams.get('limit')

    const page = pageParam ? parseInt(pageParam) : 1
    const limit = limitParam ? parseInt(limitParam) : 20
    const minPrice = minPriceParam ? parseFloat(minPriceParam) : undefined
    const maxPrice = maxPriceParam ? parseFloat(maxPriceParam) : undefined

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      )
    }

    // Build where clause
    const where: any = {
      isActive: true,
      ...(inStockOnly && { stock: { gt: 0 } }),
      ...(categoryId && { categoryId }),
      ...(categorySlug && {
        category: { slug: categorySlug }
      }),
      ...(minPrice !== undefined && { price: { gte: minPrice } }),
      ...(maxPrice !== undefined && { price: { lte: maxPrice } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { tags: { hasSome: [search] } }
        ]
      })
    }

    // Build sort clause
    const orderBy: Record<string, 'asc' | 'desc'> = {}
    const validSortFields = ['price', 'name', 'createdAt']
    const validSortOrders = ['asc', 'desc']

    if (validSortFields.includes(sortBy) && validSortOrders.includes(sortOrder)) {
      orderBy[sortBy] = sortOrder as 'asc' | 'desc'
    } else {
      orderBy.name = 'asc'
    }

    // Get total count for pagination
    const totalProducts = await prisma.product.count({ where })

    // Get products with pagination
    const products = await prisma.product.findMany({
      where,
      include: {
        category: {
          select: { name: true, slug: true }
        }
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit
    })

    // Transform products to include computed fields

    const transformedProducts: ProductWithCategory[] = products.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price,
      originalPrice: product.compareAtPrice,
      compareAt: product.compareAtPrice,
      stock: product.stock,
      images: product.images,
      categoryId: product.categoryId,
      category: product.category,
      tags: product.tags,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      discountPercent: product.compareAtPrice
        ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
        : 0,
      sku: product.sku,
      featured: product.isFeatured,
      inStock: product.stock > 0
    }));

    const response: PaginatedResponse<ProductWithCategory> = {
      success: true,
      data: transformedProducts,
      pagination: {
        page,
        limit,
        total: totalProducts,
        totalPages: Math.ceil(totalProducts / limit)
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}
