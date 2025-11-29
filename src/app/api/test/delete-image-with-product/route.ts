import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../lib/auth'
import { prisma } from '../../../../../lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Test DELETE functionality that retrieves productId from image
    console.log('🧪 Testing image DELETE with productId retrieval...')

    // 1. Get a test product
    const testProduct = await prisma.product.findFirst({
      select: { 
        id: true, 
        name: true,
        images: true 
      }
    })

    if (!testProduct) {
      return NextResponse.json({ 
        error: 'No test product found',
        message: 'Please create a product first'
      }, { status: 404 })
    }

    console.log(`📦 Using test product: ${testProduct.name} (${testProduct.id})`)

    // 2. Create a test image record linked to the product
    const testImage = await prisma.image.create({
      data: {
        serviceImageId: `test-${Date.now()}`,
        filename: 'test-image.jpg',
        originalName: 'test-image.jpg',
        mimeType: 'image/jpeg',
        size: 12345,
        isPublic: true,
        serviceUrl: 'http://test.com/image.jpg',
        publicUrl: `/api/public/images/test-${Date.now()}`,
        productId: testProduct.id,
        uploadedBy: session.user.id,
        uploadedByEmail: session.user.email || 'test@example.com'
      }
    })

    console.log(`📸 Created test image: ${testImage.id}`)

    // 3. Add image to product's images array
    await prisma.product.update({
      where: { id: testProduct.id },
      data: {
        images: {
          set: [...testProduct.images, testImage.id]
        }
      }
    })

    console.log(`🔗 Linked image to product`)

    // 4. Test the DELETE endpoint
    const deleteResponse = await fetch(`${request.nextUrl.origin}/api/images/${testImage.id}`, {
      method: 'DELETE',
      headers: {
        'Cookie': request.headers.get('cookie') || ''
      }
    })

    const deleteResult = await deleteResponse.json()
    console.log(`🗑️ DELETE response:`, deleteResult)

    // 5. Verify image was deleted from database
    const deletedImage = await prisma.image.findUnique({
      where: { id: testImage.id }
    })

    // 6. Verify image was removed from product
    const updatedProduct = await prisma.product.findUnique({
      where: { id: testProduct.id },
      select: { images: true }
    })

    const results = {
      success: true,
      testSteps: {
        productId: testProduct.id,
        imageId: testImage.id,
        deleteResponse: {
          status: deleteResponse.status,
          data: deleteResult
        },
        verification: {
          imageDeletedFromDB: deletedImage === null,
          imageRemovedFromProduct: updatedProduct ? !updatedProduct.images.includes(testImage.id) : false,
          productIdReturned: deleteResult.productId === testProduct.id
        }
      }
    }

    console.log('✅ Test completed:', results)

    return NextResponse.json(results)

  } catch (error) {
    console.error('❌ Test failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
