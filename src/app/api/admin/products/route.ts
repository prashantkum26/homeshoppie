import { NextRequest, NextResponse } from 'next/server'
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ApiResponse } from '@/types'

const { auth } = NextAuth(authOptions)

interface ProductCreateInput {
  name: string
  description: string
  price: number
  compareAt?: number
  images: string[]
  categoryId: string
  stock: number
  slug: string
  weight?: number
  unit?: 
  | 'GRAMS'
  | 'KILOGRAMS'
  | 'POUNDS'
  | 'OUNCES'
  | 'LITER'
  | 'MILLILITER'
  | 'PIECE'
  | 'PACK';
  tags: string[]
}

interface ProductWithCategory {
  id: string
  name: string
  slug: string
  description: string | null
  price: number
  compareAtPrice?: number
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

// GET all products (admin only)
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const products = await prisma.product.findMany({
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            orderItems: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(products)
  } catch (error) {
    console.error('Error fetching products for admin:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<ProductWithCategory> | { error: string }>> {
  try {
    const body: ProductCreateInput = await request.json()
    const {
      name,
      description,
      price,
      compareAt,
      images: productImages,
      categoryId,
      stock,
      slug,
      weight,
      unit,
      tags
    } = body

    // Validate required fields
    if (!name || !description || !price || !categoryId || !slug) {
      console.log({
        name,
        description,
        price,
        compareAt,
        productImages,
        categoryId,
        stock,
        slug,
        weight,
        unit,
        tags
      })
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    let images: string[] = [];

    if (!productImages?.length) {
      images.push("/api/images/dummy")
    }

    // Check if product already exists
    const existingProduct = await prisma.product.findFirst({
      where: {
        OR: [
          { name },
          { slug }
        ]
      }
    })

    if (existingProduct) {
      return NextResponse.json(
        { error: 'Product already exists' },
        { status: 409 }
      )
    }

    const product = await prisma.product.create({
      data: {
        name,
        description,
        price,
        compareAtPrice: compareAt ?? null,
        images,
        categoryId,
        stock,
        slug,
        weight: weight ?? 0,
        weightUnit: unit ?? "GRAMS",
        tags
      },
      include: {
        category: {
          select: { name: true, slug: true }
        }
      }
    })

    const productWithMeta: ProductWithCategory = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price,
      originalPrice: product.compareAtPrice,
      stock: product.stock,
      sku: null,
      images: product.images,
      categoryId: product.categoryId,
      featured: false,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      category: product.category,
      inStock: product.stock > 0,
      discountPercent: product.compareAtPrice
        ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
        : 0
    }

    const response: ApiResponse<ProductWithCategory> = {
      success: true,
      data: productWithMeta,
      message: 'Product created successfully'
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    )
  }
}