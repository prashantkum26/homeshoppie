import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../../lib/auth'
import { imageService } from '../../../../../lib/homeshoppieImageService'
import { prisma } from '../../../../../../lib/prisma'

// Admin-only image access endpoint using HomeshoppieImageService
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    // Require admin authentication for admin image access
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    const { id: imageId } = await params
    const { searchParams } = new URL(request.url)
    const size = searchParams.get('size') as 'thumbnail' | 'small' | 'medium' | 'large' | 'original' || 'original'
    
    // Handle local fallback images
    if (imageId.startsWith('local-')) {
      console.log(`📷 Admin serving local fallback image: ${imageId}`)
      return serveLocalFallbackImage(imageId, size)
    }

    try {
      // Get image stream using HomeshoppieImageService
      const response = await imageService.getImageStream(imageId, size)

      if (!response.ok) {
        return NextResponse.json(
          { error: 'Image not found' },
          { status: response.status }
        )
      }

      // Stream the image response
      const imageBuffer = await response.arrayBuffer()
      const contentType = response.headers.get('content-type') || 'image/jpeg'
      
      return new NextResponse(imageBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'private, max-age=3600',
          'ETag': response.headers.get('etag') || '',
          'Last-Modified': response.headers.get('last-modified') || new Date().toUTCString(),
          'X-Access-Level': 'admin',
          'X-User-ID': session.user.id,
          'X-Service': 'homeshoppie-image-service'
        }
      })

    } catch (serviceError) {
      console.error('External service error, serving admin fallback:', serviceError)
      // If external service fails, serve local fallback
      return serveLocalFallbackImage(imageId, size)
    }

  } catch (error) {
    console.error('Admin image proxy error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Serve local fallback image for admin (placeholder with admin badge)
async function serveLocalFallbackImage(imageId: string, size?: string) {
  try {
    // Create a simple SVG placeholder based on the size requested
    const dimensions = getSizeDimensions(size)
    
    const svgContent = `
      <svg width="${dimensions.width}" height="${dimensions.height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f9fafb"/>
        <rect x="10%" y="10%" width="80%" height="80%" fill="#f3f4f6" rx="8" stroke="#e5e7eb" stroke-width="2"/>
        <rect x="75%" y="15%" width="20%" height="15%" fill="#dc2626" rx="4"/>
        <text x="85%" y="25%" font-family="Arial, sans-serif" font-size="8" text-anchor="middle" fill="white">
          ADMIN
        </text>
        <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#374151">
          HomeShoppe
        </text>
        <text x="50%" y="60%" font-family="Arial, sans-serif" font-size="10" text-anchor="middle" fill="#6b7280">
          Product Image
        </text>
        <text x="50%" y="75%" font-family="Arial, sans-serif" font-size="8" text-anchor="middle" fill="#9ca3af">
          ${size || 'original'} • ${imageId.substring(0, 20)}...
        </text>
      </svg>
    `
    
    return new NextResponse(svgContent, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'private, max-age=3600',
        'X-Access-Level': 'admin',
        'X-Content-Source': 'local-fallback-admin',
        'X-Image-ID': imageId
      }
    })
  } catch (error) {
    console.error('Error serving admin local fallback:', error)
    return NextResponse.json(
      { error: 'Failed to serve image' },
      { status: 500 }
    )
  }
}

// Get dimensions based on size parameter
function getSizeDimensions(size?: string) {
  switch (size) {
    case 'thumbnail':
      return { width: 150, height: 150 }
    case 'small':
      return { width: 300, height: 300 }
    case 'medium':
      return { width: 600, height: 600 }
    case 'large':
      return { width: 1200, height: 1200 }
    default:
      return { width: 800, height: 600 }
  }
}

// Delete image - admin only using HomeshoppieImageService
export async function DELETE(
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

    const { id: imageId } = await params
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    // Always try to remove from product first if productId is provided
    let updatedProduct = null
    if (productId) {
      try {
        // Generate possible image URLs to remove
        const possibleUrls = [
          `/api/public/images/${imageId}`,
          `/api/admin/images/${imageId}`,
          `/api/images/${imageId}`,
          imageId // In case full URL is passed as ID
        ]
        
        // Get current product to update images array
        const product = await prisma.product.findUnique({
          where: { id: productId },
          select: { images: true, name: true }
        })
        
        if (product) {
          // Remove any matching URLs from the array
          const updatedImages = product.images.filter(img => 
            !possibleUrls.some(url => img === url || img.includes(imageId))
          )
          
          updatedProduct = await prisma.product.update({
            where: { id: productId },
            data: {
              images: updatedImages,
              updatedAt: new Date()
            }
          })
          
          console.log(`✅ Removed image ${imageId} from product ${productId}`)
          console.log(`Previous images: ${product.images.length}, New images: ${updatedImages.length}`)
        }
      } catch (dbError) {
        console.error('❌ Failed to update product in database:', dbError)
        return NextResponse.json(
          { error: 'Failed to remove image from product' },
          { status: 500 }
        )
      }
    }
    
    // Handle local fallback images (just remove from database)
    if (imageId.startsWith('local-')) {
      console.log(`🗑️ Deleting local fallback image: ${imageId}`)
      
      // Remove from product's images array if productId provided
      let updatedProduct = null
      if (productId) {
        try {
          const imageUrl = `/api/public/images/${imageId}`
          
          // Get current product to update images array
          const product = await prisma.product.findUnique({
            where: { id: productId },
            select: { images: true }
          })
          
          if (product) {
            // Remove the image URL from the array
            const updatedImages = product.images.filter(img => img !== imageUrl)
            
            updatedProduct = await prisma.product.update({
              where: { id: productId },
              data: {
                images: updatedImages,
                updatedAt: new Date()
              }
            })
            
            console.log(`✅ Removed local image ${imageUrl} from product ${productId}`)
          }
        } catch (dbError) {
          console.error('❌ Failed to update product in database:', dbError)
          return NextResponse.json(
            { error: 'Failed to remove image from product' },
            { status: 500 }
          )
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Local image reference deleted successfully',
        databaseUpdated: !!updatedProduct,
        ...(updatedProduct && {
          product: {
            id: updatedProduct.id,
            images: updatedProduct.images,
            totalImages: updatedProduct.images.length
          }
        })
      })
    }

    // Delete image using HomeshoppieImageService for external images
    const success = await imageService.deleteImage(imageId)

    return NextResponse.json({
      success: success,
      message: success ? 'Image deleted successfully' : 'Failed to delete image from service',
      databaseUpdated: !!updatedProduct,
      ...(updatedProduct && {
        product: {
          id: updatedProduct.id,
          images: updatedProduct.images,
          totalImages: updatedProduct.images.length
        }
      })
    }, { status: success ? 200 : 500 })

  } catch (error) {
    console.error('Admin delete proxy error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to delete image',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
}
