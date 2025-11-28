import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../lib/auth'
import { imageService } from '../../../../lib/homeshoppieImageService'

// Image upload endpoint using HomeshoppieImageService
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    // Get the form data from the request
    const formData = await request.formData()
    const file = formData.get('image') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      )
    }

    // Extract metadata from form data
    const productId = formData.get('productId') as string
    const category = formData.get('category') as string || 'product'
    const entityType = formData.get('entityType') as string || 'product'
    const alt = formData.get('alt') as string
    const title = formData.get('title') as string || file.name

    // Extract tags
    let tags: string[] = ['homeshoppie']
    const tagsParam = formData.get('tags') as string
    if (tagsParam) {
      try {
        tags = [...tags, ...JSON.parse(tagsParam)]
      } catch {
        // If parsing fails, treat as comma-separated string
        tags = [...tags, ...tagsParam.split(',').map(t => t.trim())]
      }
    }

    // Upload image using HomeshoppieImageService
    const uploadedImage = await imageService.uploadImage(file, {
      isPublic: category === 'product' || entityType === 'product', // Product images are public
      alt: alt || `${category} image - ${title}`,
      title,
      tags,
      category,
      entityType,
      productId
    })

    // Return response compatible with existing frontend
    return NextResponse.json({
      success: true,
      data: {
        imageId: uploadedImage.id,
        originalName: uploadedImage.filename,
        filename: uploadedImage.filename,
        size: uploadedImage.size,
        mimeType: uploadedImage.mimeType,
        url: uploadedImage.url,
        publicUrl: uploadedImage.publicUrl,
        accessToken: '', // Not needed with new service
        uploadedAt: uploadedImage.createdAt
      },
      homeshoppie: {
        uploadedBy: session.user.id,
        uploadedByEmail: session.user.email,
        uploadedAt: new Date().toISOString(),
        category,
        entityType,
        productId
      }
    })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to upload image',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
}
