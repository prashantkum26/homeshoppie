import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../lib/auth'

// DEPRECATED: Legacy image access endpoint - Use /api/admin/images/[id] or /api/public/images/[id] instead
// This endpoint now requires admin authentication for backward compatibility
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    // Require admin authentication for legacy endpoint access
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { 
          error: 'Unauthorized - This endpoint requires admin access. Use /api/public/images/[id] for public product images.',
          redirectTo: '/api/public/images/' 
        },
        { status: 401 }
      )
    }

    const { id: imageId } = await params
    const { searchParams } = new URL(request.url)
    const size = searchParams.get('size') || 'original'
    
    // Auto-authenticate with image service for admin access
    const imageServiceAuth = await authenticateWithImageService(session.user)
    if (!imageServiceAuth.success) {
      return NextResponse.json(
        { error: 'Failed to authenticate with image service' },
        { status: 500 }
      )
    }

    // Forward request to image service with admin authentication
    const imageServiceUrl = process.env.IMAGE_SERVICE_URL || 'http://localhost:3001/api'
    const response = await fetch(`${imageServiceUrl}/images/${imageId}?size=${size}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${imageServiceAuth.token}`,
        'Cache-Control': 'public, max-age=31536000',
      }
    })

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
        'Cache-Control': 'public, max-age=31536000',
        'ETag': response.headers.get('etag') || '',
        'Last-Modified': response.headers.get('last-modified') || new Date().toUTCString(),
        'X-Access-Level': 'admin-legacy',
        'X-Deprecated': 'Use /api/admin/images/[id] or /api/public/images/[id]'
      }
    })

  } catch (error) {
    console.error('Legacy image proxy error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DEPRECATED: Legacy delete endpoint - Use /api/admin/images/[id] instead
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { 
          error: 'Unauthorized - Use /api/admin/images/[id] for admin operations',
          redirectTo: '/api/admin/images/'
        },
        { status: 401 }
      )
    }

    const { id: imageId } = await params
    
    // Auto-authenticate with image service
    const imageServiceAuth = await authenticateWithImageService(session.user)
    if (!imageServiceAuth.success) {
      return NextResponse.json(
        { error: 'Failed to authenticate with image service' },
        { status: 500 }
      )
    }

    // Forward delete request to image service
    const imageServiceUrl = process.env.IMAGE_SERVICE_URL || 'http://localhost:3001/api'
    const response = await fetch(`${imageServiceUrl}/images/${imageId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${imageServiceAuth.token}`,
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Image service delete error:', errorText)
      return NextResponse.json(
        { error: 'Failed to delete image' },
        { status: response.status }
      )
    }

    const result = await response.json()
    return NextResponse.json({
      ...result,
      deprecated: 'Use /api/admin/images/[id] for future operations'
    })

  } catch (error) {
    console.error('Legacy delete proxy error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Auto-authenticate with image service (same function as upload)
async function authenticateWithImageService(user: any) {
  try {
    const imageServiceUrl = process.env.IMAGE_SERVICE_URL || 'http://localhost:3001/api'
    
    // Generate consistent credentials for homeshoppie users
    const username = `homeshoppie_${user.email.replace(/[^a-zA-Z0-9]/g, '_')}`
    const password = process.env.IMAGE_SERVICE_AUTO_PASSWORD || 'homeshoppie_secure_2024'
    
    // Try to login first
    try {
      const loginResponse = await fetch(`${imageServiceUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: user.email,
          password: password
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
      console.log('Login failed, attempting registration...')
    }

    // If login fails, try to register
    const registerResponse = await fetch(`${imageServiceUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: username,
        email: user.email,
        password: password
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
      console.error('Registration failed:', errorText)
      return { success: false, error: errorText }
    }

  } catch (error) {
    console.error('Image service authentication error:', error)
    return { success: false, error: error }
  }
}
