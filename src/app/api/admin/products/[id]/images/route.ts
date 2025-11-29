import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../../../lib/auth'
import { prisma } from '../../../../../../../lib/prisma'

// Get product images - admin only
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    const { id: productId } = await params
    
    // Get product with images
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        images: true
      }
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Transform image URLs to include metadata
    const images = product.images.map((url, index) => {
      // Extract image ID from URL
      let imageId = `image-${index}`
      if (url.includes('/api/public/images/')) {
        imageId = url.replace('/api/public/images/', '').split('?')[0]
      } else if (url.includes('/api/admin/images/')) {
        imageId = url.replace('/api/admin/images/', '').split('?')[0]
      }

      return {
        id: imageId,
        filename: `product-image-${index + 1}`,
        url: url,
        publicUrl: url.startsWith('/api/public/') ? url : `/api/public/images/${imageId}`,
        size: 0, // Size not tracked in current system
        mimeType: 'image/jpeg', // Default mime type
        alt: `${product.name} - Image ${index + 1}`,
        tags: ['product', 'homeshoppie'],
        category: 'product',
        isPublic: true,
        createdAt: new Date().toISOString()
      }
    })

    return NextResponse.json({
      success: true,
      images: images,
      product: {
        id: product.id,
        name: product.name,
        totalImages: images.length
      }
    })

  } catch (error) {
    console.error('Error fetching product images:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch product images',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
}
