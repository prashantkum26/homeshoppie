import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ApiResponse } from '@/types'


interface ProductCreateInput {
  name: string
  description: string
  price: number
  compareAtPrice?: number
  images: string[]
  categoryId: string
  stock: number
  slug: string
  weight?: number
  unit?:
  | 'GRAMS'
  | 'KILOGRAMS'
  | 'POUNDS'
  | 'OUNCES'
  | 'LITER'
  | 'MILLILITER'
  | 'PIECE'
  | 'PACK';
  tags: string[]
}

interface ProductWithCategory {
  id: string
  name: string
  slug: string
  description: string | null
  price: number
  compareAtPrice?: number
  originalPrice: number | null
  stock: number
  sku: string | null
  images: string[]
  categoryId: string
  featured: boolean
  createdAt: Date
  updatedAt: Date
  category: {
    name: string
    slug: string
  }
  inStock: boolean
  discountPercent: number
}

// GET all products (admin only)
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const products = await prisma.product.findMany({
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            orderItems: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(products)
  } catch (error) {
    console.error('Error fetching products for admin:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<ProductWithCategory> | { error: string }>> {
//   try {
//     const body: ProductCreateInput = await request.json()
//     const {
//       name,
//       description,
//       price,
//       compareAtPrice,
//       images: productImages,
//       categoryId,
//       stock,
//       slug,
//       weight,
//       unit,
//       tags
//     } = body

//     // Validate required fields
//     if (!name || !description || !price || !categoryId || !slug) {
//       console.log({
//         name,
//         description,
//         price,
//         compareAtPrice,
//         productImages,
//         categoryId,
//         stock,
//         slug,
//         weight,
//         unit,
//         tags
//       })
//       return NextResponse.json(
//         { error: 'Missing required fields' },
//         { status: 400 }
//       )
//     }

//     let images: string[] = [];

//     if (!productImages?.length) {
//       images.push("/api/images/dummy")
//     }

//     // Check if product already exists
//     const existingProduct = await prisma.product.findFirst({
//       where: {
//         OR: [
//           { name },
//           { slug }
//         ]
//       }
//     })

//     if (existingProduct) {
//       return NextResponse.json(
//         { error: 'Product already exists' },
//         { status: 409 }
//       )
//     }

//     const product = await prisma.product.create({
//       data: {
//         name,
//         description,
//         price,
//         compareAtPrice: compareAtPrice ?? null,
//         images,
//         categoryId,
//         stock,
//         slug,
//         weight: weight ?? 0,
//         weightUnit: unit ?? "GRAMS",
//         tags
//       },
//       include: {
//         category: {
//           select: { name: true, slug: true }
//         }
//       }
//     })

//     const productWithMeta: ProductWithCategory = {
//       id: product.id,
//       name: product.name,
//       slug: product.slug,
//       description: product.description,
//       price: product.price,
//       originalPrice: product.compareAtPrice,
//       stock: product.stock,
//       sku: null,
//       images: product.images,
//       categoryId: product.categoryId,
//       featured: false,
//       createdAt: product.createdAt,
//       updatedAt: product.updatedAt,
//       category: product.category,
//       inStock: product.stock > 0,
//       discountPercent: product.compareAtPrice
//         ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
//         : 0
//     }

//     const response: ApiResponse<ProductWithCategory> = {
//       success: true,
//       data: productWithMeta,
//       message: 'Product created successfully'
//     }

//     return NextResponse.json(response, { status: 201 })
//   } catch (error) {
//     console.error('Error creating product:', error)
//     return NextResponse.json(
//       { error: 'Failed to create product' },
//       { status: 500 }
//     )
//   }
// }

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<ProductWithCategory> | { error: string }>> {
  try {
    const session = await auth()

    // Safety check for session
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: ProductCreateInput = await request.json()
    const {
      name, description, price, compareAtPrice, images: productImages,
      categoryId, stock, slug, weight, unit, tags
    } = body

    // Validate required fields
    if (!name || !description || !price || !categoryId || !slug) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    let images: string[] = [];
    if (!productImages?.length) {
      images.push("/api/images/dummy")
    } else {
      images = productImages
    }

    // Check if product already exists
    const existingProduct = await prisma.product.findFirst({
      where: { OR: [{ name }, { slug }] }
    })

    if (existingProduct) {
      return NextResponse.json({ error: 'Product already exists' }, { status: 409 })
    }

    // 1. Create the Product
    const product = await prisma.product.create({
      data: {
        name, description, price, compareAtPrice: compareAtPrice ?? null,
        images, categoryId, stock, slug, weight: weight ?? 0,
        weightUnit: unit ?? "GRAMS", tags
      },
      include: {
        category: { select: { name: true, slug: true } }
      }
    })

    // 2. NEW: Sync images to the Image collection
    try {
      const validUrls = images.filter(url => !url.includes('dummy'))

      for (let i = 0; i < validUrls.length; i++) {
        const url = validUrls[i]

        // Extract the raw ID from your API url
        let serviceImageId = url
        if (url.includes('/api/public/images/')) {
          serviceImageId = url.replace('/api/public/images/', '').split('?')[0]
        } else if (url.includes('/api/admin/images/')) {
          serviceImageId = url.replace('/api/admin/images/', '').split('?')[0]
        }

        // Upsert: Create it if missing, or just link it to the product if it exists
        await prisma.image.upsert({
          where: { serviceImageId },
          update: {
            productId: product.id,
            alt: `${product.name} - Image ${i + 1}`
          },
          create: {
            serviceImageId,
            filename: `product-${product.id.slice(-5)}-${i}`,
            originalName: `${product.name} - Image ${i + 1}`,
            mimeType: 'image/jpeg',
            fileSize: '0',
            serviceUrl: url,
            publicUrl: url.startsWith('/api') ? url : `/api/public/images/${serviceImageId}`,
            category: 'product',
            alt: `${product.name} product image`,
            productId: product.id,
            uploadedBy: session.user.id,
            uploadedByEmail: session.user.email || 'admin@homeshoppie.com',
          }
        })
      }
    } catch (imageSyncError) {
      console.error('Failed to sync images to Image collection:', imageSyncError)
      // We don't fail the product creation if image sync fails, just log it.
    }

    const productWithMeta: ProductWithCategory = {
      id: product.id, name: product.name, slug: product.slug, description: product.description,
      price: product.price, originalPrice: product.compareAtPrice, stock: product.stock,
      sku: null, images: product.images, categoryId: product.categoryId, featured: false,
      createdAt: product.createdAt, updatedAt: product.updatedAt, category: product.category,
      inStock: product.stock > 0,
      discountPercent: product.compareAtPrice ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100) : 0
    }

    return NextResponse.json({
      success: true, data: productWithMeta, message: 'Product created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}