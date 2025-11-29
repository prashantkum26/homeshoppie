import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../lib/auth'
import { prisma } from '../../../../../lib/prisma'

// Get images from database with full metadata
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    
    // Build filters
    const where: any = {}
    if (productId) {
      where.productId = productId
    }

    // Get total count for pagination
    const total = await prisma.image.count({ where })

    // Get images with pagination
    const images = await prisma.image.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    })

    return NextResponse.json({
      success: true,
      data: {
        images,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    })

  } catch (error) {
    console.error('Database images fetch error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch images from database',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
}

// Get single image from database by service ID or database ID
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    const { imageId, serviceImageId } = await request.json()

    if (!imageId && !serviceImageId) {
      return NextResponse.json(
        { error: 'Either imageId or serviceImageId is required' },
        { status: 400 }
      )
    }

    // Find image by database ID or service ID
    const where = imageId 
      ? { id: imageId }
      : { serviceImageId: serviceImageId }

    const image = await prisma.image.findUnique({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            category: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })

    if (!image) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { image }
    })

  } catch (error) {
    console.error('Database image fetch error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch image from database',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
}
