import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'

// Fix undefined image URLs in products
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    // Get all products and clean up undefined/invalid image URLs
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        images: true
      }
    })

    let fixedProducts = 0
    const results = []

    for (const product of products) {
      // Filter out undefined, null, or invalid image URLs
      const validImages = product.images.filter(img => 
        img && 
        img !== 'undefined' && 
        img !== 'null' && 
        img.includes('/api/') && 
        !img.includes('undefined')
      )

      // If there are invalid images, update the product
      if (validImages.length !== product.images.length) {
        await prisma.product.update({
          where: { id: product.id },
          data: {
            images: validImages,
            updatedAt: new Date()
          }
        })

        fixedProducts++
        results.push({
          id: product.id,
          name: product.name,
          before: product.images,
          after: validImages,
          removed: product.images.length - validImages.length
        })

        console.log(`✅ Fixed product ${product.name}: removed ${product.images.length - validImages.length} invalid image URLs`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Fixed ${fixedProducts} products with invalid image URLs`,
      data: {
        totalProducts: products.length,
        fixedProducts,
        results
      }
    })

  } catch (error) {
    console.error('Fix images error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fix images',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
}

// Get status of all products and their images
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    // Get all products and analyze their image URLs
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        images: true,
        updatedAt: true
      },
      orderBy: { updatedAt: 'desc' }
    })

    const analysis = products.map(product => {
      const validImages = product.images.filter(img => 
        img && 
        img !== 'undefined' && 
        img !== 'null' && 
        img.includes('/api/') && 
        !img.includes('undefined')
      )

      const invalidImages = product.images.filter(img => 
        !img || 
        img === 'undefined' || 
        img === 'null' || 
        img.includes('undefined')
      )

      return {
        id: product.id,
        name: product.name,
        totalImages: product.images.length,
        validImages: validImages.length,
        invalidImages: invalidImages.length,
        images: product.images,
        hasInvalidImages: invalidImages.length > 0,
        lastUpdated: product.updatedAt
      }
    })

    const summary = {
      totalProducts: products.length,
      productsWithImages: analysis.filter(p => p.totalImages > 0).length,
      productsWithInvalidImages: analysis.filter(p => p.hasInvalidImages).length,
      totalInvalidImages: analysis.reduce((sum, p) => sum + p.invalidImages, 0)
    }

    return NextResponse.json({
      success: true,
      data: {
        summary,
        products: analysis
      }
    })

  } catch (error) {
    console.error('Get image status error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get image status',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
}
