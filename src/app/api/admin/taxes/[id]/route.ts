import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { taxEngine } from '@/lib/taxEngine'
import { z } from 'zod'

// Validation schema for tax configuration updates
const UpdateTaxConfigSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'GST', 'CGST', 'SGST', 'IGST', 'STATE_TAX', 'CITY_TAX']).optional(),
  rate: z.number().min(0, 'Rate must be non-negative').optional(),
  isActive: z.boolean().optional(),
  applicableIn: z.array(z.string()).optional(),
  productTypes: z.array(z.string()).optional(),
  minAmount: z.number().min(0).nullable().optional(),
  maxAmount: z.number().min(0).nullable().optional(),
  validFrom: z.string().optional(),
  validUntil: z.string().nullable().optional(),
  regulationRef: z.string().nullable().optional()
})

// GET single tax configuration
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const taxId = (await params).id

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

// PATCH update tax configuration (Changed from PUT to match Frontend UI)
// PATCH update tax configuration
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const taxId = (await params).id
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
        data.minAmount !== null && data.maxAmount !== null &&
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

    // Safely build the update object to satisfy TypeScript exactOptionalPropertyTypes
    const updateData: Record<string, any> = {
      updatedBy: session.user.id,
      updatedAt: new Date()
    }

    if (data.name !== undefined) updateData.name = data.name
    if (data.type !== undefined) updateData.type = data.type
    if (data.rate !== undefined) updateData.rate = data.rate
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (data.applicableIn !== undefined) updateData.applicableIn = data.applicableIn
    if (data.productTypes !== undefined) updateData.productTypes = data.productTypes
    if (data.minAmount !== undefined) updateData.minAmount = data.minAmount
    if (data.maxAmount !== undefined) updateData.maxAmount = data.maxAmount
    if (data.regulationRef !== undefined) updateData.regulationRef = data.regulationRef

    // Handle dates carefully so we never pass `undefined`
    if (data.validFrom !== undefined && data.validFrom !== '') {
      updateData.validFrom = new Date(data.validFrom)
    }
    
    if (data.validUntil !== undefined) {
      updateData.validUntil = data.validUntil ? new Date(data.validUntil) : null
    }

    // Update tax configuration
    const updatedTaxConfiguration = await prisma.taxConfiguration.update({
      where: { id: taxId },
      data: updateData
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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Restrict Hard Delete to SUPER_ADMIN only
    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Only Super Admins can hard delete tax records. Please deactivate it instead.' }, 
        { status: 403 }
      )
    }

    const taxId = (await params).id

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