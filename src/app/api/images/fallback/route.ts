import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../lib/auth'
import { prisma } from '../../../../../lib/prisma'

// Fallback local image upload when external service is down
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

    // Generate a mock image record for local development
    const mockImageId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Create image record in database with fallback data
    let savedImage = null
    let updatedProduct = null

    try {
      savedImage = await prisma.image.create({
        data: {
          serviceImageId: mockImageId,
          filename: file.name,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
          width: 800, // Mock dimensions
          height: 600,
          alt: alt || `${category} image - ${title}`,
          title: title,
          category: category,
          tags: ['homeshoppie', category, 'local-fallback'],
          isPublic: true, // ✅ ALWAYS PUBLIC for products
          
          // Service URLs (using placeholder)
          serviceUrl: `/api/images/fallback/${mockImageId}`,
          publicUrl: `/api/public/images/${mockImageId}`,
          thumbnailUrl: `/api/public/images/${mockImageId}?size=thumbnail`,
          smallUrl: `/api/public/images/${mockImageId}?size=small`,
          mediumUrl: `/api/public/images/${mockImageId}?size=medium`,
          largeUrl: `/api/public/images/${mockImageId}?size=large`,
          
          // Store fallback metadata
          variants: {
            fallback: true,
            originalSize: file.size,
            uploadDate: new Date().toISOString()
          },
          
          // Link to product if provided
          productId: productId || null,
          
          // Upload tracking
          uploadedBy: session.user.id,
          uploadedByEmail: session.user.email || ''
        }
      })
      
      console.log(`✅ Created fallback image record: ${savedImage.id}`)
      
      // Update product's images array if productId provided
      if (productId && (category === 'product' || entityType === 'product')) {
        updatedProduct = await prisma.product.update({
          where: { id: productId },
          data: {
            images: {
              push: savedImage.id // Store database image ID
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
        
        console.log(`✅ Updated product ${productId} with fallback image ID: ${savedImage.id}`)
      }
    } catch (dbError) {
      console.error('❌ Failed to save fallback image to database:', dbError)
      return NextResponse.json(
        { error: 'Database error while saving image' },
        { status: 500 }
      )
    }

    // Return success response
    return NextResponse.json({
      success: true,
      data: {
        imageId: mockImageId,
        originalName: file.name,
        filename: file.name,
        size: file.size,
        mimeType: file.type,
        url: `/api/images/fallback/${mockImageId}`,
        publicUrl: `/api/public/images/${mockImageId}`,
        accessToken: '', 
        uploadedAt: new Date().toISOString()
      },
      homeshoppie: {
        uploadedBy: session.user.id,
        uploadedByEmail: session.user.email,
        uploadedAt: new Date().toISOString(),
        category,
        entityType,
        productId,
        databaseUpdated: !!updatedProduct,
        fallbackMode: true // Indicates this was uploaded in fallback mode
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
    console.error('Fallback upload error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to upload image in fallback mode',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
}
