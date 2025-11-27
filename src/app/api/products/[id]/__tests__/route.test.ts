import { NextRequest } from 'next/server'
import { GET } from '../route'
import { prisma } from '@/lib/prisma'

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}))

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('/api/products/[id] - GET', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const mockProduct = {
    id: '1',
    slug: 'test-product',
    name: 'Test Product',
    description: 'Test Description',
    price: 100,
    originalPrice: 120,
    compareAt: 120,
    stock: 10,
    sku: 'TEST001',
    images: ['image1.jpg'],
    categoryId: 'cat1',
    category: { name: 'Test Category', slug: 'test-category' },
    featured: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockRelatedProducts = [
    {
      id: '2',
      slug: 'related-product',
      name: 'Related Product',
      price: 80,
      compareAt: 100,
      stock: 5,
      categoryId: 'cat1',
      isActive: true,
      createdAt: new Date(),
    },
  ]

  it('should return product by id successfully', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(mockProduct as any)
    mockPrisma.product.findMany.mockResolvedValue(mockRelatedProducts as any)

    const request = new NextRequest('http://localhost/api/products/1')
    const response = await GET(request, { params: Promise.resolve({ id: '1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.id).toBe('1')
    expect(data.inStock).toBe(true)
    expect(data.discountPercent).toBe(17) // (120-100)/120 * 100 = 16.67 rounded to 17
    expect(data.relatedProducts).toHaveLength(1)
    expect(mockPrisma.product.findUnique).toHaveBeenCalledWith({
      where: { OR: [{ id: '1' }, { slug: '1' }] },
      include: { category: { select: { name: true, slug: true } } },
    })
  })

  it('should return product by slug successfully', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(mockProduct as any)
    mockPrisma.product.findMany.mockResolvedValue(mockRelatedProducts as any)

    const request = new NextRequest('http://localhost/api/products/test-product')
    const response = await GET(request, { params: Promise.resolve({ id: 'test-product' }) })

    expect(response.status).toBe(200)
    expect(mockPrisma.product.findUnique).toHaveBeenCalledWith({
      where: { OR: [{ id: 'test-product' }, { slug: 'test-product' }] },
      include: { category: { select: { name: true, slug: true } } },
    })
  })

  it('should return 404 when product not found', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/products/nonexistent')
    const response = await GET(request, { params: Promise.resolve({ id: 'nonexistent' }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Product not found')
  })

  it('should return 404 when product is inactive', async () => {
    const inactiveProduct = { ...mockProduct, isActive: false }
    mockPrisma.product.findUnique.mockResolvedValue(inactiveProduct as any)

    const request = new NextRequest('http://localhost/api/products/1')
    const response = await GET(request, { params: Promise.resolve({ id: '1' }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Product not found')
  })

  it('should handle products without compareAt price', async () => {
    const productWithoutCompareAt = { ...mockProduct, compareAt: null }
    mockPrisma.product.findUnique.mockResolvedValue(productWithoutCompareAt as any)
    mockPrisma.product.findMany.mockResolvedValue([])

    const request = new NextRequest('http://localhost/api/products/1')
    const response = await GET(request, { params: Promise.resolve({ id: '1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.discountPercent).toBe(0)
  })

  it('should handle out-of-stock products', async () => {
    const outOfStockProduct = { ...mockProduct, stock: 0 }
    mockPrisma.product.findUnique.mockResolvedValue(outOfStockProduct as any)
    mockPrisma.product.findMany.mockResolvedValue([])

    const request = new NextRequest('http://localhost/api/products/1')
    const response = await GET(request, { params: Promise.resolve({ id: '1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.inStock).toBe(false)
  })

  it('should return 500 on database error', async () => {
    mockPrisma.product.findUnique.mockRejectedValue(new Error('Database error'))

    const request = new NextRequest('http://localhost/api/products/1')
    const response = await GET(request, { params: Promise.resolve({ id: '1' }) })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to fetch product')
  })

  it('should fetch related products correctly', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(mockProduct as any)
    mockPrisma.product.findMany.mockResolvedValue(mockRelatedProducts as any)

    const request = new NextRequest('http://localhost/api/products/1')
    const response = await GET(request, { params: Promise.resolve({ id: '1' }) })
    const data = await response.json()

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
      where: {
        categoryId: 'cat1',
        id: { not: '1' },
        isActive: true,
        stock: { gt: 0 },
      },
      take: 4,
      orderBy: { createdAt: 'desc' },
    })
    expect(data.relatedProducts).toHaveLength(1)
    expect(data.relatedProducts[0].inStock).toBe(true)
    expect(data.relatedProducts[0].discountPercent).toBe(20) // (100-80)/100 * 100
  })
})
