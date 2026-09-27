import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await auth()

    // Require admin authentication
    if (!session?.user?.id || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    // Fetch all image metadata from the database
    // Including the product relation so admins can see where the image is used
    const images = await prisma.image.findMany({
      // where: {
      //   deletedAt: null // Only fetch active images
      // },
      orderBy: {
        createdAt: 'desc' // Newest first
      },
      select: {
        id: true,
        serviceImageId: true,
        filename: true,
        originalName: true,
        mimeType: true,
        fileSize: true,
        width: true,
        height: true,
        alt: true,
        category: true,
        createdAt: true,
        productId: true,
        product: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    return NextResponse.json(images)

  } catch (error) {
    console.error('Error fetching media library:', error)
    return NextResponse.json(
      { error: 'Internal server error while fetching media' },
      { status: 500 }
    )
  }
}