import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { taxEngine } from '@/lib/taxEngine'
import { z } from 'zod'

// Validation schema for tax configuration updates
const UpdateTaxConfigSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'GST', 'STATE_TAX', 'CITY_TAX']).optional(),
  rate: z.number().min(0, 'Rate must be non-negative').optional(),
  isActive: z.boolean().optional(),
  applicableIn: z.array(z.string()).optional(),
  productTypes: z.array(z.string()).optional(),
  minAmount: z.number().min(0).optional(),
  maxAmount: z.number().min(0).optional()
})

// GET single tax configuration
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const taxId = params.id

    const taxConfiguration = await prisma.taxConfiguration.findUnique({
      where: { id: taxId }
    })

    if (!taxConfiguration) {
      return NextResponse.json(
        { error: 'Tax configuration not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(taxConfiguration)
  } catch (error) {
    console.error('Error fetching tax configuration:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT update tax configuration
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const taxId = params.id
    const body = await request.json()

    // Validate input
    const validationResult = UpdateTaxConfigSchema.safeParse(body)
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
    if (data.minAmount !== undefined && data.maxAmount !== undefined && 
        data.minAmount >= data.maxAmount) {
      return NextResponse.json(
        { error: 'Minimum amount must be less than maximum amount' },
        { status: 400 }
      )
    }

    // Check if tax configuration exists
    const existingTax = await prisma.taxConfiguration.findUnique({
      where: { id: taxId }
    })

    if (!existingTax) {
      return NextResponse.json(
        { error: 'Tax configuration not found' },
        { status: 404 }
      )
    }

    // Check for duplicate names (if name is being changed)
    if (data.name && data.name !== existingTax.name) {
      const duplicateTax = await prisma.taxConfiguration.findUnique({
        where: { name: data.name }
      })

      if (duplicateTax) {
        return NextResponse.json(
          { error: 'Tax configuration with this name already exists' },
          { status: 400 }
        )
      }
    }

    // Update tax configuration
    const updatedTaxConfiguration = await prisma.taxConfiguration.update({
      where: { id: taxId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.rate !== undefined && { rate: data.rate }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.applicableIn !== undefined && { applicableIn: data.applicableIn }),
        ...(data.productTypes !== undefined && { productTypes: data.productTypes }),
        ...(data.minAmount !== undefined && { minAmount: data.minAmount }),
        ...(data.maxAmount !== undefined && { maxAmount: data.maxAmount }),
        updatedAt: new Date()
      }
    })

    // Clear tax engine cache to reflect changes
    taxEngine.clearCache()

    return NextResponse.json(updatedTaxConfiguration)
  } catch (error) {
    console.error('Error updating tax configuration:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE tax configuration
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const taxId = params.id

    // Check if tax configuration exists
    const existingTax = await prisma.taxConfiguration.findUnique({
      where: { id: taxId }
    })

    if (!existingTax) {
      return NextResponse.json(
        { error: 'Tax configuration not found' },
        { status: 404 }
      )
    }

    // Delete tax configuration
    await prisma.taxConfiguration.delete({
      where: { id: taxId }
    })

    // Clear tax engine cache to reflect changes
    taxEngine.clearCache()

    return NextResponse.json(
      { message: 'Tax configuration deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error deleting tax configuration:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
