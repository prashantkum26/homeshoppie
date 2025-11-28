import { NextRequest, NextResponse } from 'next/server'
import { imageService } from '../../../../../lib/homeshoppieImageService'

// Public product image access endpoint - no authentication required
// Uses HomeshoppieImageService with public access validation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: imageId } = await params
    const { searchParams } = new URL(request.url)
    const size = searchParams.get('size') as 'thumbnail' | 'small' | 'medium' | 'large' | 'original' || 'original'
    
    // First, get image metadata to verify it's public
    const imageData = await imageService.getImage(imageId)
    
    // Only allow access to public product images
    if (!imageData.isPublic || !isPublicProductImage(imageData)) {
      return NextResponse.json(
        { error: 'Access denied - Image is not public' },
        { status: 403 }
      )
    }

    // Get image stream using public URL approach
    const publicImageUrl = imageService.getPublicImageUrl(imageId, size)
    const response = await fetch(publicImageUrl)

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
        'Cache-Control': 'public, max-age=86400', // 24 hours for public images
        'ETag': response.headers.get('etag') || '',
        'Last-Modified': response.headers.get('last-modified') || new Date().toUTCString(),
        'X-Access-Level': 'public',
        'X-Content-Source': 'product-image',
        'X-Service': 'homeshoppie-image-service'
      }
    })

  } catch (error) {
    console.error('Public image proxy error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Get admin authentication token for internal operations
async function getAdminAuthToken() {
  try {
    const imageServiceUrl = process.env.IMAGE_SERVICE_URL || 'http://localhost:3001/api'
    
    // Use system admin credentials for public image access
    const adminEmail = process.env.IMAGE_SERVICE_ADMIN_EMAIL || 'admin@homeshoppie.com'
    const adminPassword = process.env.IMAGE_SERVICE_AUTO_PASSWORD || 'homeshoppie_secure_2024'
    
    // Try to login with system admin
    try {
      const loginResponse = await fetch(`${imageServiceUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: adminEmail,
          password: adminPassword
        })
      })

      if (loginResponse.ok) {
        const loginResult = await loginResponse.json()
        return {
          success: true,
          token: loginResult.data.accessToken
        }
      }
    } catch (loginError) {
      console.log('Admin login failed, attempting registration...')
    }

    // If login fails, try to register system admin
    const registerResponse = await fetch(`${imageServiceUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'homeshoppie_system_admin',
        email: adminEmail,
        password: adminPassword
      })
    })

    if (registerResponse.ok) {
      const registerResult = await registerResponse.json()
      return {
        success: true,
        token: registerResult.data.accessToken
      }
    } else {
      const errorText = await registerResponse.text()
      console.error('System admin registration failed:', errorText)
      return { success: false, error: errorText }
    }

  } catch (error) {
    console.error('System admin authentication error:', error)
    return { success: false, error: error }
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
