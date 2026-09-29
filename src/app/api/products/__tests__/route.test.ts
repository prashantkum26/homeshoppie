import { NextRequest } from 'next/server'
import { GET } from '../route'
import { prisma } from '@/lib/prisma'

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  },
}))

const mockPrisma = prisma as any

describe('/api/products - GET', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const mockProducts = [
    {
      id: '507f1f77bcf86cd799439012',
      name: 'Product 1',
      slug: 'product-1',
      description: 'Description 1',
      price: 99.99,
      compareAtPrice: 149.99,
      images: ['image1.jpg'],
      categoryId: '507f1f77bcf86cd799439011',
      stock: 10,
      sku: 'SKU1',
      tags: ['electronics'],
      isActive: true,
      isFeatured: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      category: {
        name: 'Electronics',
        slug: 'electronics',
      },
    },
    {
      id: '507f1f77bcf86cd799439013',
      name: 'Product 2',
      slug: 'product-2',
      description: 'Description 2',
      price: 49.99,
      compareAtPrice: null,
      images: ['image2.jpg'],
      categoryId: '507f1f77bcf86cd799439012',
      stock: 0,
      sku: 'SKU2',
      tags: ['books'],
      isActive: true,
      isFeatured: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      category: {
        name: 'Books',
        slug: 'books',
      },
    },
  ]

  it('should fetch products successfully', async () => {
    mockPrisma.product.count.mockResolvedValue(2)
    mockPrisma.product.findMany.mockResolvedValue(mockProducts)

    const request = new NextRequest('http://localhost:3000/api/products')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data).toHaveLength(2)
    expect(data.pagination.total).toBe(2)
    expect(data.data[0].inStock).toBe(true)
    expect(data.data[1].inStock).toBe(false)
    expect(data.data[0].discountPercent).toBe(33) // ((149.99 - 99.99) / 149.99) * 100
  })

  it('should handle search parameters', async () => {
    mockPrisma.product.count.mockResolvedValue(1)
    mockPrisma.product.findMany.mockResolvedValue([mockProducts[0]])

    const request = new NextRequest('http://localhost:3000/api/products?search=Product%201&page=1&limit=10')
    await GET(request)

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        OR: [
          { name: { contains: 'Product 1', mode: 'insensitive' } },
          { description: { contains: 'Product 1', mode: 'insensitive' } },
          { tags: { hasSome: ['Product 1'] } },
        ],
      },
      include: {
        category: {
          select: { name: true, slug: true },
        },
      },
      orderBy: { name: 'asc' },
      skip: 0,
      take: 10,
    })
  })

  it('should handle category filtering by categorySlug', async () => {
    mockPrisma.product.count.mockResolvedValue(1)
    mockPrisma.product.findMany.mockResolvedValue([mockProducts[0]])

    const request = new NextRequest('http://localhost:3000/api/products?categorySlug=electronics')
    await GET(request)

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        category: { slug: 'electronics' },
      },
      include: {
        category: {
          select: { name: true, slug: true },
        },
      },
      orderBy: { name: 'asc' },
      skip: 0,
      take: 20,
    })
  })

  it('should apply sorting when valid sortBy/sortOrder are given', async () => {
    mockPrisma.product.count.mockResolvedValue(2)
    mockPrisma.product.findMany.mockResolvedValue(mockProducts)

    const request = new NextRequest('http://localhost:3000/api/products?sortBy=price&sortOrder=desc')
    await GET(request)

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { price: 'desc' } })
    )
  })

  it('should filter in-stock-only products', async () => {
    mockPrisma.product.count.mockResolvedValue(1)
    mockPrisma.product.findMany.mockResolvedValue([mockProducts[0]])

    const request = new NextRequest('http://localhost:3000/api/products?inStockOnly=true')
    await GET(request)

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ stock: { gt: 0 } }),
      })
    )
  })

  it('should validate pagination parameters', async () => {
    const request = new NextRequest('http://localhost:3000/api/products?page=0&limit=200')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid pagination parameters')
  })

  it('should handle database errors', async () => {
    mockPrisma.product.count.mockRejectedValue(new Error('Database error'))

    const request = new NextRequest('http://localhost:3000/api/products')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to fetch products')
  })
})
