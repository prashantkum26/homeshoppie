import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const type = searchParams.get('type') // 'all', 'products', 'users', 'orders'
    const limit = parseInt(searchParams.get('limit') || '10')
    
    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        success: false,
        message: 'Search query must be at least 2 characters'
      }, { status: 400 })
    }

    const session = await auth()
    const searchTerm = query.trim().toLowerCase()
    
    const results: any = {
      products: [],
      users: [],
      orders: [],
      categories: []
    }

    // Search Products (public)
    if (!type || type === 'all' || type === 'products') {
      const products = await prisma.product.findMany({
        where: {
          AND: [
            { isActive: true },
            { isVisible: true },
            {
              OR: [
                { name: { contains: searchTerm, mode: 'insensitive' } },
                { description: { contains: searchTerm, mode: 'insensitive' } },
                { shortDescription: { contains: searchTerm, mode: 'insensitive' } },
                { sku: { contains: searchTerm, mode: 'insensitive' } },
                { searchKeywords: { has: searchTerm } },
                { tags: { has: searchTerm } }
              ]
            }
          ]
        },
        select: {
          id: true,
          name: true,
          description: true,
          shortDescription: true,
          price: true,
          images: true,
          slug: true,
          stock: true,
          category: {
            select: {
              name: true,
              slug: true
            }
          }
        },
        take: limit,
        orderBy: [
          { isFeatured: 'desc' },
          { createdAt: 'desc' }
        ]
      })

      results.products = products.map(product => ({
        ...product,
        type: 'product',
        url: `/products/${product.slug}`,
        subtitle: product.category.name,
        price: product.price / 100 // Convert from paise to rupees
      }))
    }

    // Search Categories (public)
    if (!type || type === 'all' || type === 'categories') {
      const categories = await prisma.category.findMany({
        where: {
          AND: [
            { isActive: true },
            { isVisible: true },
            {
              OR: [
                { name: { contains: searchTerm, mode: 'insensitive' } },
                { description: { contains: searchTerm, mode: 'insensitive' } }
              ]
            }
          ]
        },
        select: {
          id: true,
          name: true,
          description: true,
          slug: true,
          image: true,
          _count: {
            select: {
              products: {
                where: {
                  isActive: true,
                  isVisible: true
                }
              }
            }
          }
        },
        take: Math.floor(limit / 2),
        orderBy: { sortOrder: 'asc' }
      })

      results.categories = categories.map(category => ({
        ...category,
        type: 'category',
        url: `/categories/${category.slug}`,
        subtitle: `${category._count.products} products`
      }))
    }

    // Search Users (admin only)
    if (session?.user?.role === 'ADMIN' && (!type || type === 'all' || type === 'users')) {
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } },
            { phone: { contains: searchTerm } }
          ]
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true
        },
        take: Math.floor(limit / 2),
        orderBy: { createdAt: 'desc' }
      })

      results.users = users.map(user => ({
        ...user,
        type: 'user',
        url: `/admin/users/${user.id}`,
        subtitle: `${user.role} • ${user.email}`
      }))
    }

    // Search Orders (user's own orders or admin can see all)
    if (session && (!type || type === 'all' || type === 'orders')) {
      const whereCondition = session.user.role === 'ADMIN' 
        ? {
            OR: [
              { orderNumber: { contains: searchTerm, mode: 'insensitive' } },
              { user: { name: { contains: searchTerm, mode: 'insensitive' } } },
              { user: { email: { contains: searchTerm, mode: 'insensitive' } } }
            ]
          }
        : {
            AND: [
              { userId: session.user.id },
              { orderNumber: { contains: searchTerm, mode: 'insensitive' } }
            ]
          }

      const orders = await prisma.order.findMany({
        where: whereCondition,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          user: {
            select: {
              name: true,
              email: true
            }
          }
        },
        take: Math.floor(limit / 2),
        orderBy: { createdAt: 'desc' }
      })

      // Get order items count separately to avoid the _count issue
      const ordersWithCount = await Promise.all(
        orders.map(async (order) => {
          const orderItemsCount = await prisma.orderItem.count({
            where: { orderId: order.id }
          })
          
          return {
            ...order,
            itemsCount: orderItemsCount
          }
        })
      )

      results.orders = ordersWithCount.map(order => ({
        ...order,
        type: 'order',
        url: session.user.role === 'ADMIN' 
          ? `/admin/orders/${order.id}` 
          : `/orders/${order.id}`,
        subtitle: `${order.itemsCount} items • ₹${(order.totalAmount / 100).toFixed(2)}`,
        totalAmount: order.totalAmount / 100 // Convert from paise to rupees
      }))
    }

    // Calculate total results
    const totalResults = results.products.length + 
                        results.categories.length + 
                        results.users.length + 
                        results.orders.length

    // Log search for analytics (only if user is logged in)
    if (session?.user?.id) {
      try {
        await prisma.userActivityLog.create({
          data: {
            userId: session.user.id,
            action: 'READ',
            resource: 'search',
            metadata: {
              query: searchTerm,
              type: type || 'all',
              resultCount: totalResults,
              userAgent: request.headers.get('user-agent') || 'unknown'
            },
            ipAddress: request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown'
          }
        })
      } catch (logError) {
        console.error('Failed to log search activity:', logError)
        // Don't fail the search if logging fails
      }
    }

    return NextResponse.json({
      success: true,
      query: searchTerm,
      results,
      totalResults,
      hasMore: totalResults >= limit
    })

  } catch (error: any) {
    console.error('Search error:', error)
    return NextResponse.json({
      success: false,
      message: 'Search failed',
      error: process.env.NODE_ENV === 'development' ? error?.message : 'Internal server error'
    }, { status: 500 })
  }
}

// Handle unsupported methods
export async function POST() {
  return NextResponse.json(
    { message: 'Method not allowed' },
    { status: 405 }
  )
}

export async function PUT() {
  return NextResponse.json(
    { message: 'Method not allowed' },
    { status: 405 }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { message: 'Method not allowed' },
    { status: 405 }
  )
}
