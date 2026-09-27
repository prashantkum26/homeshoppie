import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
// Adjust this import path to match where your imageService actually lives
import { imageService } from '@/lib/homeshoppieImageService' 

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Get file from frontend (Support both 'file' and 'image' keys for safety)
    const formData = await request.formData()
    const file = (formData.get('file') || formData.get('image')) as File
    
    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 })
    }

    // 2. Extract metadata
    const productId = formData.get('productId') as string | null
    const category = (formData.get('category') as string) || 'product'
    const entityType = (formData.get('entityType') as string) || 'product'
    const alt = formData.get('alt') as string
    const title = (formData.get('title') as string) || file.name

    // Parse tags gracefully
    let tags: string[] = ['homeshoppie']
    const tagsParam = formData.get('tags') as string
    if (tagsParam) {
      try {
        tags = [...tags, ...JSON.parse(tagsParam)]
      } catch {
        tags = [...tags, ...tagsParam.split(',').map(t => t.trim())]
      }
    }

    let uploadedImage: any

    // 3. Upload using your native image service
    try {
      // Build the options object safely using the spread operator for conditional keys
      const uploadOptions = {
        isPublic: true, 
        alt: alt || `${category} image - ${title}`,
        title,
        tags,
        category,
        entityType,
        ...(productId && { productId }) // <--- FIX: Only adds the key if productId is truthy
      };

      uploadedImage = await imageService.uploadImage(file, uploadOptions)
      console.log('✅ External image service upload successful')
    } catch (serviceError) {
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
        isPublic: true,
        createdAt: new Date().toISOString()
      }
    }

    // Calculate Aspect Ratio if metadata exists
    const width = uploadedImage.metadata?.width || null
    const height = uploadedImage.metadata?.height || null
    const aspectRatio = (width && height) ? parseFloat((width / height).toFixed(4)) : null

    // 4. SAVE TO EXISTING PRISMA SCHEMA FOR THE MEDIA LIBRARY
    const dbImage = await prisma.image.create({
      data: {
        serviceImageId: uploadedImage.id || uploadedImage.imageId,
        serviceName: 'homeshoppie-service',
        filename: uploadedImage.filename || file.name,
        originalName: uploadedImage.originalName || file.name,
        mimeType: uploadedImage.mimetype || uploadedImage.mimeType || file.type,
        fileSize: String(uploadedImage.size || file.size), 
        width,
        height,
        aspectRatio,
        alt: uploadedImage.alt || alt,
        title: uploadedImage.title || title,
        category: uploadedImage.category || category,
        tags: uploadedImage.tags || tags,
        isPublic: uploadedImage.isPublic !== false,
        
        // Map URLs safely relying on your service payload
        serviceUrl: uploadedImage.accessUrl || uploadedImage.url || '',
        publicUrl: uploadedImage.publicUrls?.original || uploadedImage.publicUrl || `/api/public/images/${uploadedImage.id}`,
        thumbnailUrl: uploadedImage.publicUrls?.thumbnail || `${uploadedImage.publicUrl}?size=thumbnail`,
        smallUrl: uploadedImage.publicUrls?.small || null,
        mediumUrl: uploadedImage.publicUrls?.medium || null,
        largeUrl: uploadedImage.publicUrls?.large || null,
        
        variants: uploadedImage.variants ? (uploadedImage.variants as any) : null, 
        accessToken: uploadedImage.accessToken || null,
        
        productId: productId || null,
        uploadedBy: session.user.id,
        uploadedByEmail: session.user.email || 'admin@homeshoppie.com',
        uploadedFrom: request.headers.get('x-forwarded-for') || null
      }
    })

    // 5. If uploaded from a Product page, link it to the product's image array automatically
    if (productId && (category === 'product' || entityType === 'product')) {
      try {
        await prisma.product.update({
          where: { id: productId },
          data: {
            images: { push: dbImage.publicUrl },
            updatedAt: new Date()
          }
        })
        console.log(`✅ Updated product ${productId} with new image`)
      } catch (dbError) {
        console.error('❌ Failed to update product in database:', dbError)
      }
    }

    // 6. Return response shaped exactly for the ImageUploader UI
    return NextResponse.json({
      success: true,
      image: dbImage,
      url: dbImage.publicUrl,
      // Pass back raw data to maintain legacy compatibility if needed
      data: {
        imageId: dbImage.serviceImageId,
        url: dbImage.publicUrl,
        thumbnailUrl: dbImage.thumbnailUrl
      }
    }, { status: 201 })

  } catch (error: any) {
    console.error('Image Upload & Sync Error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}