import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../../lib/auth'
import { prisma } from '../../../../../../lib/prisma'

// GET single product for admin
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: productId } = await params

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(product)
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH update product
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: productId } = await params
    const body = await request.json()
    
    // Handle both simple status updates and full product updates
    const {
      name,
      description,
      price,
      compareAt,
      stock,
      weight,
      unit,
      tags,
      categoryId,
      isActive,
      images
    } = body

    const updateData: any = {}

    // Full product update (from edit page)
    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json(
          { error: 'Product name is required' },
          { status: 400 }
        )
      }
      updateData.name = name.trim()
      // Generate slug from name
      updateData.slug = name
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
    }

    if (description !== undefined) {
      if (!description.trim()) {
        return NextResponse.json(
          { error: 'Product description is required' },
          { status: 400 }
        )
      }
      updateData.description = description.trim()
    }

    if (price !== undefined) {
      if (typeof price !== 'number' || price <= 0) {
        return NextResponse.json(
          { error: 'Price must be greater than 0' },
          { status: 400 }
        )
      }
      updateData.price = price
    }

    if (compareAt !== undefined) {
      updateData.compareAt = compareAt || null
    }

    if (stock !== undefined) {
      if (typeof stock !== 'number' || stock < 0) {
        return NextResponse.json(
          { error: 'Stock cannot be negative' },
          { status: 400 }
        )
      }
      updateData.stock = stock
    }

    if (weight !== undefined) {
      updateData.weight = weight || null
    }

    if (unit !== undefined) {
      updateData.unit = unit || null
    }

    if (tags !== undefined) {
      if (!Array.isArray(tags)) {
        return NextResponse.json(
          { error: 'Tags must be an array' },
          { status: 400 }
        )
      }
      updateData.tags = tags
    }

    if (categoryId !== undefined) {
      if (!categoryId) {
        return NextResponse.json(
          { error: 'Category is required' },
          { status: 400 }
        )
      }
      updateData.categoryId = categoryId
    }

    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive)
    }

    if (images !== undefined) {
      if (!Array.isArray(images)) {
        return NextResponse.json(
          { error: 'Images must be an array' },
          { status: 400 }
        )
      }
      updateData.images = images
    }

    // Update timestamp
    updateData.updatedAt = new Date()

    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: updateData,
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    return NextResponse.json(updatedProduct)
  } catch (error) {
    console.error('Error updating product:', error)
    
    // Handle Prisma errors
    if (error instanceof Error) {
      if (error.message.includes('Record to update not found')) {
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 404 }
        )
      }
      if (error.message.includes('Unique constraint failed')) {
        return NextResponse.json(
          { error: 'Product with this name already exists' },
          { status: 400 }
        )
      }
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
