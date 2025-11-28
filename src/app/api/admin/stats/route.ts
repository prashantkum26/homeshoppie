import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET admin dashboard stats
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get total counts
    const [totalUsers, totalProducts, totalOrders] = await Promise.all([
      prisma.user.count(),
      prisma.product.count(),
      prisma.order.count()
    ])

    // Get total revenue
    const revenueResult = await prisma.order.aggregate({
      _sum: {
        totalAmount: true
      }
    })

    // Get recent orders
    const recentOrders = await prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    // Get low stock products (stock < 10)
    const lowStockProducts = await prisma.product.findMany({
      where: {
        stock: {
          lt: 10
        },
        isActive: true
      },
      include: {
        category: {
          select: {
            name: true
          }
        }
      }
    })

    const stats = {
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue: revenueResult._sum.totalAmount || 0,
      recentOrders,
      lowStockProducts
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching admin stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
