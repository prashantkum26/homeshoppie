import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface WishlistItem {
  id: string
  name: string
  price: number
  images: string[]
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const wishlistItems = body.wishlistItems || body.items || []

    if (!Array.isArray(wishlistItems)) {
      return NextResponse.json({ error: 'Invalid wishlist data' }, { status: 400 })
    }

    // Get existing wishlist items
    const existingWishlist = await prisma.wishlist.findMany({
      where: { userId: session.user.id }
    })

    const existingProductIds = new Set(existingWishlist.map((item) => item.productId))
    
    // Prepare items to add (only new items not already in database)
    const itemsToAdd = wishlistItems.filter((item: WishlistItem) => 
      item.id && !existingProductIds.has(item.id)
    )

    // Add new items to database
    if (itemsToAdd.length > 0) {
      await prisma.wishlist.createMany({
        data: itemsToAdd.map((item: WishlistItem) => ({
          userId: session.user.id,
          productId: item.id,
        }))
      })
    }

    // Get updated wishlist with product details
    const updatedWishlist = await prisma.wishlist.findMany({
      where: { userId: session.user.id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            images: true,
            stock: true,
            category: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })

    // Format response
    const formattedWishlist = updatedWishlist.map((item) => ({
      id: item.product.id,
      name: item.product.name,
      price: item.product.price,
      images: item.product.images,
      category: item.product.category?.name
    }))

    return NextResponse.json({
      success: true,
      wishlist: formattedWishlist,
      synced: itemsToAdd.length,
      total: formattedWishlist.length
    })

  } catch (error) {
    console.error('Wishlist sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync wishlist' },
      { status: 500 }
    )
  }
}
