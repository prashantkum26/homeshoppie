import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../../lib/auth'
import { imageService } from '../../../../../lib/homeshoppieImageService'

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
        'Cache-Control': 'public, max-age=31536000',
        'ETag': response.headers.get('etag') || '',
        'Last-Modified': response.headers.get('last-modified') || new Date().toUTCString(),
        'X-Access-Level': 'admin',
        'X-Service': 'homeshoppie-image-service'
      }
    })

  } catch (error) {
    console.error('Admin image proxy error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
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
    
    // Delete image using HomeshoppieImageService
    const success = await imageService.deleteImage(imageId)

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Image deleted successfully'
      })
    } else {
      return NextResponse.json(
        { error: 'Failed to delete image' },
        { status: 500 }
      )
    }

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
