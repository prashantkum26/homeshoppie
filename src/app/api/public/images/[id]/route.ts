import { NextRequest, NextResponse } from 'next/server'
import { imageService } from '../../../../../lib/homeshoppieImageService'

// Public product image access endpoint - no authentication required
// Handles both external service images and local fallback images
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: imageId } = await params
    const { searchParams } = new URL(request.url)
    const size = searchParams.get('size') as 'thumbnail' | 'small' | 'medium' | 'large' | 'original' || 'original'
    
    // Handle local fallback images
    if (imageId.startsWith('local-')) {
      console.log(`📷 Serving local fallback image: ${imageId}`)
      return serveLocalFallbackImage(imageId, size)
    }

    try {
      // Try to get image stream directly (skip metadata validation for better performance)
      const response = await imageService.getImageStream(imageId, size)

      if (!response.ok) {
        throw new Error(`Image stream failed: ${response.statusText}`)
      }

      // Stream the image response
      const imageBuffer = await response.arrayBuffer()
      const contentType = response.headers.get('content-type') || 'image/jpeg'
      
      return new NextResponse(imageBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
          'ETag': response.headers.get('etag') || '',
          'Last-Modified': response.headers.get('last-modified') || new Date().toUTCString(),
          'X-Access-Level': 'public',
          'X-Content-Source': 'external-service',
          'X-Service': 'homeshoppie-image-service'
        }
      })

    } catch (serviceError) {
      console.error('External service error, serving fallback:', serviceError)
      // If external service fails, serve local fallback
      return serveLocalFallbackImage(imageId, size)
    }

  } catch (error) {
    console.error('Public image proxy error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Serve local fallback image (placeholder)
async function serveLocalFallbackImage(imageId: string, size?: string) {
  try {
    // Create a simple SVG placeholder based on the size requested
    const dimensions = getSizeDimensions(size)
    
    const svgContent = `
      <svg width="${dimensions.width}" height="${dimensions.height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f3f4f6"/>
        <rect x="20%" y="20%" width="60%" height="60%" fill="#e5e7eb" rx="8"/>
        <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="12" text-anchor="middle" fill="#9ca3af">
          HomeShoppe
        </text>
        <text x="50%" y="60%" font-family="Arial, sans-serif" font-size="10" text-anchor="middle" fill="#6b7280">
          Product Image
        </text>
        <text x="50%" y="75%" font-family="Arial, sans-serif" font-size="8" text-anchor="middle" fill="#9ca3af">
          ${size || 'original'}
        </text>
      </svg>
    `
    
    return new NextResponse(svgContent, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
        'X-Access-Level': 'public',
        'X-Content-Source': 'local-fallback',
        'X-Image-ID': imageId
      }
    })
  } catch (error) {
    console.error('Error serving local fallback:', error)
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

// Check if image is a public product image
function isPublicProductImage(imageData: any): boolean {
  try {
    // Check if it's a product image
    const isProductImage = imageData.category === 'product' || 
                          imageData.entityType === 'product' ||
                          (imageData.metadata && imageData.metadata.sourceApp === 'homeshoppie')

    // Check if it's marked as public (default true for product images)
    const isPublic = imageData.isPublic !== false // Default to true if not explicitly set

    // Additional security: check if it has product metadata
    const hasProductMetadata = imageData.productId || 
                              (imageData.tags && imageData.tags.includes('product')) ||
                              (imageData.metadata && imageData.metadata.productId)

    return isProductImage && isPublic && hasProductMetadata
  } catch (error) {
    console.error('Error checking image accessibility:', error)
    return false // Deny access if we can't verify
  }
}
