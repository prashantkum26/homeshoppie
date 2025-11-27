import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Category, ApiResponse } from '@/types'

interface CategoryCreateInput {
  name: string
  description?: string
  slug: string
  image?: string
}

interface CategoryWithProductCount extends Category {
  productCount: number
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<Category> | { error: string }>> {
  try {
    const body: CategoryCreateInput = await request.json()
    const { name, description, slug, image } = body

    // Validate required fields
    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      )
    }

    // Check if category already exists
    const existingCategory = await prisma.category.findFirst({
      where: {
        OR: [
          { name },
          { slug }
        ]
      }
    })

    if (existingCategory) {
      return NextResponse.json(
        { error: 'Category already exists' },
        { status: 409 }
      )
    }

    const category = await prisma.category.create({
      data: {
        name,
        description: description || null,
        slug,
        image: image || null
      }
    })

    const response: ApiResponse<Category> = {
      success: true,
      data: category,
      message: 'Category created successfully'
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('Error creating category:', error)
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<Category[] | CategoryWithProductCount[]> | { error: string }>> {
  try {
    const { searchParams } = new URL(request.url)
    const includeProducts = searchParams.get('include') === 'products'

    const categories = includeProducts 
      ? await prisma.category.findMany({
          include: {
            products: {
              where: { isActive: true },
              select: { id: true }
            }
          },
          orderBy: { name: 'asc' }
        })
      : await prisma.category.findMany({
          orderBy: { name: 'asc' }
        })

    let result: Category[] | CategoryWithProductCount[]

    // If including products, add product count
    if (includeProducts) {
      result = categories.map((category: any) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        image: category.image,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
        productCount: category.products?.length || 0,
      })) as CategoryWithProductCount[]
    } else {
      result = categories as Category[]
    }

    const response: ApiResponse<Category[] | CategoryWithProductCount[]> = {
      success: true,
      data: result,
      message: 'Categories fetched successfully'
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}
