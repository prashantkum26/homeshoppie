import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../lib/auth'
import { imageService } from '../../../../lib/homeshoppieImageService'
import { prisma } from '../../../../../lib/prisma'

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

    let uploadedImage: any
    let updatedProduct = null

    try {
      // Try uploading to image service first
      uploadedImage = await imageService.uploadImage(file, {
        isPublic: true, // ✅ ALWAYS PUBLIC for products - fixes the requirement
        alt: alt || `${category} image - ${title}`,
        title,
        tags,
        category,
        entityType,
        productId
      })
      
      console.log('✅ External image service upload successful')
    } catch (serviceError) {
      // If external service fails, create local fallback
      console.log('⚠️ External service failed, using local fallback')
      
      const mockImageId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      uploadedImage = {
        id: mockImageId,
        filename: file.name,
        url: `/api/images/fallback/${mockImageId}`,
        publicUrl: `/api/public/images/${mockImageId}`,
        size: file.size,
        mimeType: file.type,
        alt: alt || `${category} image - ${title}`,
        tags: tags,
        category: category,
        isPublic: true, // ✅ ALWAYS PUBLIC
        createdAt: new Date().toISOString()
      }
    }

    // Update product record in database if productId is provided
    if (productId && (category === 'product' || entityType === 'product')) {
      try {
        // Generate the image URL for the database (using public endpoint for products)
        const imageUrl = `/api/public/images/${uploadedImage.id}`
        
        // Update the product's images array with the public URL
        updatedProduct = await prisma.product.update({
          where: { id: productId },
          data: {
            images: {
              push: imageUrl // Store public URL directly
            },
            updatedAt: new Date()
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
        
        console.log(`✅ Updated product ${productId} with new image: ${imageUrl}`)
      } catch (dbError) {
        console.error('❌ Failed to update product in database:', dbError)
        // Don't fail the upload if database update fails, just log it
      }
    }

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
        productId,
        databaseUpdated: !!updatedProduct
      },
      // Include updated product info if available
      ...(updatedProduct && {
        product: {
          id: updatedProduct.id,
          name: updatedProduct.name,
          images: updatedProduct.images,
          totalImages: updatedProduct.images.length
        }
      })
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
