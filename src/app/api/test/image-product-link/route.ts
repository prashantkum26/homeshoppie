import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../lib/auth'
import { prisma } from '../../../../../lib/prisma'

// Test endpoint to validate image-product linking
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    // Get all products with their images
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        images: true,
        updatedAt: true,
        category: {
          select: {
            name: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })

    // Transform the data to show image linking status
    const productImageStatus = products.map(product => ({
      id: product.id,
      name: product.name,
      category: product.category.name,
      totalImages: product.images.length,
      images: product.images,
      hasImages: product.images.length > 0,
      lastUpdated: product.updatedAt,
      // Extract image IDs from URLs for reference
      imageIds: product.images.map(url => {
        const match = url.match(/\/api\/public\/images\/([^?]+)/)
        return match ? match[1] : null
      }).filter(Boolean)
    }))

    return NextResponse.json({
      success: true,
      data: {
        totalProducts: products.length,
        productsWithImages: productImageStatus.filter(p => p.hasImages).length,
        productsWithoutImages: productImageStatus.filter(p => !p.hasImages).length,
        products: productImageStatus
      }
    })

  } catch (error) {
    console.error('Test endpoint error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch test data',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
}

// Test endpoint to create a sample product for testing
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    // Get or create a test category
    let category = await prisma.category.findFirst({
      where: { name: 'Test Category' }
    })

    if (!category) {
      category = await prisma.category.create({
        data: {
          name: 'Test Category',
          description: 'Category for testing image uploads',
          slug: 'test-category'
        }
      })
    }

    // Create a test product
    const testProduct = await prisma.product.create({
      data: {
        name: `Test Product ${new Date().toISOString().slice(0, 10)}`,
        description: 'Test product for image upload validation',
        price: 99.99,
        categoryId: category.id,
        slug: `test-product-${Date.now()}`,
        stock: 10,
        images: [], // Start with no images
        tags: ['test', 'sample']
      },
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Test product created successfully',
      data: {
        product: testProduct,
        testInstructions: {
          step1: 'Use the product ID to upload images',
          step2: 'Check that images appear in the product record',
          step3: 'Verify public image URLs work',
          productId: testProduct.id,
          uploadEndpoint: '/api/images/upload',
          testEndpoint: `/api/test/image-product-link`
        }
      }
    })

  } catch (error) {
    console.error('Test product creation error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to create test product',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
}
