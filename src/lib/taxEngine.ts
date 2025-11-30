import { prisma } from '../../lib/prisma'

export interface TaxCalculationInput {
  subtotal: number
  shippingFee: number
  items: Array<{
    id: string
    name: string
    price: number
    quantity: number
    category: string
  }>
  shippingAddress: {
    state: string
    city: string
    pincode: string
  }
  userId?: string
}

export interface TaxBreakdown {
  taxId: string
  name: string
  type: string
  rate: number
  amount: number
  appliedTo: 'subtotal' | 'shipping' | 'items'
  applicableItems?: string[]
}

export interface TaxCalculationResult {
  subtotal: number
  totalTaxAmount: number
  finalTotal: number
  taxBreakdown: TaxBreakdown[]
  applicableTaxes: Array<{
    id: string
    name: string
    rate: number
    type: string
  }>
}

export class TaxEngine {
  private static instance: TaxEngine
  private taxConfigurations: any[] = []
  private lastCacheUpdate = 0
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  private constructor() {}

  public static getInstance(): TaxEngine {
    if (!TaxEngine.instance) {
      TaxEngine.instance = new TaxEngine()
    }
    return TaxEngine.instance
  }

  // Load and cache tax configurations
  private async loadTaxConfigurations(): Promise<void> {
    const now = Date.now()
    
    if (now - this.lastCacheUpdate < this.CACHE_DURATION && this.taxConfigurations.length > 0) {
      return // Use cached data
    }

    try {
      this.taxConfigurations = await prisma.taxConfiguration.findMany({
        where: { isActive: true },
        orderBy: [
          { type: 'asc' }, // GST first, then state taxes, etc.
          { rate: 'asc' }
        ]
      })
      
      this.lastCacheUpdate = now
    } catch (error) {
      console.error('Failed to load tax configurations:', error)
      // Use empty array as fallback
      this.taxConfigurations = []
    }
  }

  // Get applicable tax configurations based on location and items
  private getApplicableTaxes(input: TaxCalculationInput) {
    const { shippingAddress, items, subtotal } = input
    
    return this.taxConfigurations.filter(tax => {
      // Check minimum amount requirement
      if (tax.minAmount && subtotal < tax.minAmount) {
        return false
      }
      
      // Check maximum amount requirement
      if (tax.maxAmount && subtotal > tax.maxAmount) {
        return false
      }
      
      // Check geographic applicability
      if (tax.applicableIn.length > 0) {
        const isApplicable = tax.applicableIn.some((location: string) => {
          const locationLower = location.toLowerCase()
          return (
            shippingAddress.state.toLowerCase().includes(locationLower) ||
            shippingAddress.city.toLowerCase().includes(locationLower) ||
            shippingAddress.pincode.startsWith(location)
          )
        })
        
        if (!isApplicable) return false
      }
      
      // Check product type applicability
      if (tax.productTypes.length > 0) {
        const hasApplicableItems = items.some(item => 
          tax.productTypes.some((type: string) => 
            item.category.toLowerCase().includes(type.toLowerCase())
          )
        )
        
        if (!hasApplicableItems) return false
      }
      
      return true
    })
  }

  // Calculate tax for a specific configuration
  private calculateTaxAmount(
    tax: any, 
    input: TaxCalculationInput, 
    applicableItems: any[]
  ): number {
    const { subtotal, shippingFee } = input
    
    switch (tax.type) {
      case 'PERCENTAGE':
        if (tax.productTypes.length > 0) {
          // Apply to specific items only
          const applicableAmount = applicableItems.reduce((sum, item) => 
            sum + (item.price * item.quantity), 0
          )
          return (applicableAmount * tax.rate) / 100
        } else {
          // Apply to subtotal
          return (subtotal * tax.rate) / 100
        }
        
      case 'FIXED_AMOUNT':
        return tax.rate // Rate field contains the fixed amount
        
      case 'GST':
        // GST calculation (typically on subtotal)
        return (subtotal * tax.rate) / 100
        
      case 'STATE_TAX':
        // State tax calculation
        return (subtotal * tax.rate) / 100
        
      case 'CITY_TAX':
        // City tax calculation
        return (subtotal * tax.rate) / 100
        
      default:
        return 0
    }
  }

  // Main tax calculation method
  public async calculateTax(input: TaxCalculationInput): Promise<TaxCalculationResult> {
    await this.loadTaxConfigurations()
    
    const { subtotal, shippingFee, items } = input
    const applicableTaxes = this.getApplicableTaxes(input)
    
    const taxBreakdown: TaxBreakdown[] = []
    let totalTaxAmount = 0
    
    // Calculate each applicable tax
    for (const tax of applicableTaxes) {
      // Determine which items this tax applies to
      const applicableItems = tax.productTypes.length > 0
        ? items.filter(item => 
            tax.productTypes.some((type: string) => 
              item.category.toLowerCase().includes(type.toLowerCase())
            )
          )
        : items
      
      const taxAmount = this.calculateTaxAmount(tax, input, applicableItems)
      
      if (taxAmount > 0) {
        totalTaxAmount += taxAmount
        
        taxBreakdown.push({
          taxId: tax.id,
          name: tax.name,
          type: tax.type,
          rate: tax.rate,
          amount: Math.round(taxAmount * 100) / 100, // Round to 2 decimal places
          appliedTo: tax.productTypes.length > 0 ? 'items' : 'subtotal',
          applicableItems: applicableItems.map(item => item.id)
        })
      }
    }
    
    // Round total tax amount
    totalTaxAmount = Math.round(totalTaxAmount * 100) / 100
    
    return {
      subtotal,
      totalTaxAmount,
      finalTotal: subtotal + totalTaxAmount + shippingFee,
      taxBreakdown,
      applicableTaxes: applicableTaxes.map(tax => ({
        id: tax.id,
        name: tax.name,
        rate: tax.rate,
        type: tax.type
      }))
    }
  }

  // Validate tax calculation for edge cases
  public async validateTaxCalculation(input: TaxCalculationInput): Promise<{
    valid: boolean
    errors: string[]
    warnings: string[]
  }> {
    const errors: string[] = []
    const warnings: string[] = []
    
    // Basic validation
    if (input.subtotal < 0) {
      errors.push('Subtotal cannot be negative')
    }
    
    if (input.shippingFee < 0) {
      errors.push('Shipping fee cannot be negative')
    }
    
    if (input.items.length === 0) {
      errors.push('At least one item is required')
    }
    
    // Validate items
    for (const item of input.items) {
      if (item.price < 0) {
        errors.push(`Item ${item.name} has negative price`)
      }
      
      if (item.quantity <= 0) {
        errors.push(`Item ${item.name} has invalid quantity`)
      }
    }
    
    // Validate address
    if (!input.shippingAddress.state) {
      errors.push('Shipping state is required for tax calculation')
    }
    
    if (!input.shippingAddress.pincode) {
      warnings.push('Pincode not provided - some location-specific taxes may not apply')
    }
    
    await this.loadTaxConfigurations()
    
    // Check for conflicting tax rules
    const applicableTaxes = this.getApplicableTaxes(input)
    const gstTaxes = applicableTaxes.filter(tax => tax.type === 'GST')
    const stateTaxes = applicableTaxes.filter(tax => tax.type === 'STATE_TAX')
    
    if (gstTaxes.length > 1) {
      warnings.push('Multiple GST rules applicable - please review tax configuration')
    }
    
    if (stateTaxes.length > 1) {
      warnings.push('Multiple state tax rules applicable - please review tax configuration')
    }
    
    // Check for extremely high tax rates
    const totalTaxRate = applicableTaxes.reduce((sum, tax) => sum + tax.rate, 0)
    if (totalTaxRate > 50) { // More than 50% total tax
      warnings.push('Combined tax rate exceeds 50% - please verify tax configuration')
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  // Get tax summary for a location
  public async getTaxSummaryForLocation(state: string, city?: string): Promise<{
    applicableTaxes: Array<{
      name: string
      type: string
      rate: number
      minAmount?: number
      maxAmount?: number
    }>
    estimatedTotalRate: number
  }> {
    await this.loadTaxConfigurations()
    
    const applicableTaxes = this.taxConfigurations.filter(tax => {
      if (tax.applicableIn.length === 0) return true // Universal taxes
      
      return tax.applicableIn.some((location: string) => {
        const locationLower = location.toLowerCase()
        const stateMatch = state.toLowerCase().includes(locationLower)
        const cityMatch = city ? city.toLowerCase().includes(locationLower) : false
        
        return stateMatch || cityMatch
      })
    })
    
    const estimatedTotalRate = applicableTaxes.reduce((sum, tax) => {
      if (tax.type === 'FIXED_AMOUNT') {
        return sum // Can't estimate fixed amounts without knowing order value
      }
      return sum + tax.rate
    }, 0)
    
    return {
      applicableTaxes: applicableTaxes.map(tax => ({
        name: tax.name,
        type: tax.type,
        rate: tax.rate,
        minAmount: tax.minAmount,
        maxAmount: tax.maxAmount
      })),
      estimatedTotalRate
    }
  }

  // Clear cache (useful for admin operations)
  public clearCache(): void {
    this.taxConfigurations = []
    this.lastCacheUpdate = 0
  }
}

// Export singleton instance
export const taxEngine = TaxEngine.getInstance()

// Utility function for quick tax calculation
export async function calculateOrderTax(orderData: {
  items: Array<{
    id: string
    name: string
    price: number
    quantity: number
    category: string
  }>
  subtotal: number
  shippingFee: number
  shippingAddress: {
    state: string
    city: string
    pincode: string
  }
  userId?: string
}): Promise<TaxCalculationResult> {
  return taxEngine.calculateTax(orderData)
}
