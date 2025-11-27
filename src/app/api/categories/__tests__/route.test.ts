import { NextRequest } from 'next/server'
import { POST, GET } from '../route'
import { prisma } from '@/lib/prisma'

// Mock Prisma  
jest.mock('@/lib/prisma', () => ({
  prisma: {
    category: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}))

const mockPrisma = prisma as any

describe('/api/categories', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /api/categories', () => {
    const validCategoryData = {
      name: 'Test Category',
      description: 'Test Description',
      slug: 'test-category',
      image: 'category-image.jpg'
    }

    it('should create a category successfully', async () => {
      const mockCategory = {
        id: '507f1f77bcf86cd799439011',
        ...validCategoryData,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.category.findFirst.mockResolvedValue(null)
      mockPrisma.category.create.mockResolvedValue(mockCategory)

      const request = new NextRequest('http://localhost:3000/api/categories', {
        method: 'POST',
        body: JSON.stringify(validCategoryData)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.name).toBe(validCategoryData.name)
      expect(data.message).toBe('Category created successfully')
      expect(mockPrisma.category.create).toHaveBeenCalledWith({
        data: validCategoryData
      })
    })

    it('should return 400 for missing required fields', async () => {
      const invalidData = {
        // Missing name and slug
        description: 'Test Description',
      }

      const request = new NextRequest('http://localhost:3000/api/categories', {
        method: 'POST',
        body: JSON.stringify(invalidData)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Name and slug are required')
    })

    it('should return 409 for existing category', async () => {
      const existingCategory = {
        id: '507f1f77bcf86cd799439011',
        name: 'Test Category',
        slug: 'test-category'
      }

      mockPrisma.category.findFirst.mockResolvedValue(existingCategory)

      const request = new NextRequest('http://localhost:3000/api/categories', {
        method: 'POST',
        body: JSON.stringify(validCategoryData)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error).toBe('Category already exists')
    })

    it('should handle database errors', async () => {
      mockPrisma.category.findFirst.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/categories', {
        method: 'POST',
        body: JSON.stringify(validCategoryData)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to create category')
    })
  })

  describe('GET /api/categories', () => {
    const mockCategories = [
      {
        id: '507f1f77bcf86cd799439011',
        name: 'Electronics',
        slug: 'electronics',
        description: 'Electronic items',
        image: 'electronics.jpg',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '507f1f77bcf86cd799439012',
        name: 'Books',
        slug: 'books',
        description: 'All kinds of books',
        image: 'books.jpg',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ]

    it('should fetch categories successfully', async () => {
      mockPrisma.category.findMany.mockResolvedValue(mockCategories)

      const request = new NextRequest('http://localhost:3000/api/categories')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(2)
      expect(data.message).toBe('Categories fetched successfully')
      expect(mockPrisma.category.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' }
      })
    })

    it('should fetch categories with product count', async () => {
      const mockCategoriesWithProducts = [
        {
          ...mockCategories[0],
          products: [{ id: '1' }, { id: '2' }]
        },
        {
          ...mockCategories[1],
          products: [{ id: '3' }]
        }
      ]

      mockPrisma.category.findMany.mockResolvedValue(mockCategoriesWithProducts)

      const request = new NextRequest('http://localhost:3000/api/categories?include=products')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(2)
      expect(data.data[0].productCount).toBe(2)
      expect(data.data[1].productCount).toBe(1)
      expect(data.message).toBe('Categories fetched successfully')
      expect(mockPrisma.category.findMany).toHaveBeenCalledWith({
        include: {
          products: {
            where: { isActive: true },
            select: { id: true }
          }
        },
        orderBy: { name: 'asc' }
      })
    })

    it('should handle database errors', async () => {
      mockPrisma.category.findMany.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/categories')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch categories')
    })
  })
})
