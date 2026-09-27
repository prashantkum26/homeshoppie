import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { taxEngine } from '@/lib/taxEngine'
import { z } from 'zod'

// Validation schema for tax configuration (Updated with new fields and enums)
const TaxConfigSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'GST', 'CGST', 'SGST', 'IGST', 'STATE_TAX', 'CITY_TAX']),
  rate: z.number().min(0, 'Rate must be non-negative'),
  isActive: z.boolean().optional().default(true),
  applicableIn: z.array(z.string()).optional().default([]),
  productTypes: z.array(z.string()).optional().default([]),
  minAmount: z.number().nullable().optional(),
  maxAmount: z.number().nullable().optional(),
  validFrom: z.string().optional(),
  validUntil: z.string().nullable().optional(),
  regulationRef: z.string().nullable().optional()
})

// GET all tax configurations
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get('active')
    const type = searchParams.get('type')

    const where: any = {}
    
    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }
    
    if (type) {
      where.type = type.toUpperCase()
    }

    const taxConfigurations = await prisma.taxConfiguration.findMany({
      where,
      orderBy: [
        { isActive: 'desc' },
        { type: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    // Returned directly as an array so the frontend `setTaxes(data)` works perfectly
    return NextResponse.json(taxConfigurations)
  } catch (error) {
    console.error('Error fetching tax configurations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST create new tax configuration
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Validate input
    const validationResult = TaxConfigSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validationResult.error.issues 
        },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Additional validation
    if (data.minAmount && data.maxAmount && data.minAmount >= data.maxAmount) {
      return NextResponse.json(
        { error: 'Minimum amount must be less than maximum amount' },
        { status: 400 }
      )
    }

    // Check for duplicate names
    const existingTax = await prisma.taxConfiguration.findUnique({
      where: { name: data.name }
    })

    if (existingTax) {
      return NextResponse.json(
        { error: 'Tax configuration with this name already exists' },
        { status: 400 }
      )
    }

    // Create tax configuration
    const taxConfiguration = await prisma.taxConfiguration.create({
      data: {
        name: data.name,
        type: data.type,
        rate: data.rate,
        isActive: data.isActive,
        applicableIn: data.applicableIn,
        productTypes: data.productTypes,
        minAmount: data.minAmount ?? null,
        maxAmount: data.maxAmount ?? null,
        validFrom: data.validFrom ? new Date(data.validFrom) : new Date(),
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        regulationRef: data.regulationRef ?? null,
        updatedBy: session.user.id
      }
    })

    // Clear tax engine cache to reflect new configuration
    taxEngine.clearCache()

    return NextResponse.json(taxConfiguration, { status: 201 })
  } catch (error) {
    console.error('Error creating tax configuration:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT bulk update tax configurations (for enabling/disabling multiple)
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { ids, isActive } = body

    if (!Array.isArray(ids) || typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request body. Expected { ids: string[], isActive: boolean }' },
        { status: 400 }
      )
    }

    const updatedConfigurations = await prisma.taxConfiguration.updateMany({
      where: { id: { in: ids } },
      data: { isActive, updatedBy: session.user.id }
    })

    // Clear tax engine cache
    taxEngine.clearCache()

    return NextResponse.json({
      message: `Updated ${updatedConfigurations.count} tax configurations`,
      count: updatedConfigurations.count
    })
  } catch (error) {
    console.error('Error bulk updating tax configurations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}