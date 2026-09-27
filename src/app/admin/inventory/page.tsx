'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

// Types based on Prisma Schema
type InventoryMovement = 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'RETURN' | 'TRANSFER' | 'DAMAGED' | 'EXPIRED'

interface ProductInventory {
  id: string
  name: string
  sku: string | null
  stock: number
  lowStockThreshold: number
  isActive: boolean
  price: number
}

interface InventoryLog {
  id: string
  type: InventoryMovement
  quantity: number
  oldStock: number
  newStock: number
  notes: string | null
  createdAt: string
  createdBy: string
}

export default function InventoryManagementPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  
  const [products, setProducts] = useState<ProductInventory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Slide-over state
  const [selectedProduct, setSelectedProduct] = useState<ProductInventory | null>(null)
  const [productLogs, setProductLogs] = useState<InventoryLog[]>([])
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  
  // Adjustment Form State
  const [adjType, setAdjType] = useState<InventoryMovement>('PURCHASE')
  const [adjOperation, setAdjOperation] = useState<'add' | 'subtract'>('add')
  const [adjQuantity, setAdjQuantity] = useState<number | ''>('')
  const [adjNotes, setAdjNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [stockFilter, setStockFilter] = useState<string>('ALL')

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') router.push('/auth/signin')
    if (sessionStatus === 'authenticated') {
      if (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPER_ADMIN') {
        toast.error('Access denied.')
        router.push('/dashboard')
        return
      }
      fetchInventory()
    }
  }, [sessionStatus, router, session])

  const fetchInventory = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/admin/inventory')
      if (!response.ok) throw new Error('Failed to fetch inventory')
      setProducts(await response.json())
    } catch (error) {
      toast.error('Could not load inventory')
    } finally {
      setIsLoading(false)
    }
  }

  const openAdjustmentPanel = async (product: ProductInventory) => {
    setSelectedProduct(product)
    setAdjType('PURCHASE')
    setAdjOperation('add')
    setAdjQuantity('')
    setAdjNotes('')
    
    // Fetch logs for this specific product
    try {
      setIsLoadingLogs(true)
      const res = await fetch(`/api/admin/inventory/${product.id}/logs`)
      if (res.ok) setProductLogs(await res.json())
    } catch (e) {
      toast.error('Failed to load history')
    } finally {
      setIsLoadingLogs(false)
    }
  }

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduct || !adjQuantity || adjQuantity <= 0) return

    const quantityChange = adjOperation === 'add' ? Number(adjQuantity) : -Number(adjQuantity)

    // Prevent negative stock unless you explicitly want to allow backorders
    if (selectedProduct.stock + quantityChange < 0) {
      toast.error('Adjustment would result in negative stock.')
      return
    }

    try {
      setIsSubmitting(true)
      const response = await fetch('/api/admin/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          type: adjType,
          quantityChange,
          notes: adjNotes
        })
      })

      if (!response.ok) throw new Error('Failed to adjust stock')
      
      toast.success('Stock updated successfully')
      
      // Refresh data
      await fetchInventory()
      
      // Update selected product's stock in local state to refresh the modal UI
      const newStock = selectedProduct.stock + quantityChange
      setSelectedProduct({ ...selectedProduct, stock: newStock })
      
      // Refresh logs
      const res = await fetch(`/api/admin/inventory/${selectedProduct.id}/logs`)
      if (res.ok) setProductLogs(await res.json())
      
      // Reset form
      setAdjQuantity('')
      setAdjNotes('')
      
    } catch (error) {
      toast.error('Failed to adjust stock')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Derived Stats
  const outOfStockCount = products.filter(p => p.stock <= 0).length
  const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= p.lowStockThreshold).length

  // Filter Logic
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
    
    let matchesStock = true
    if (stockFilter === 'OUT_OF_STOCK') matchesStock = p.stock <= 0
    if (stockFilter === 'LOW_STOCK') matchesStock = p.stock > 0 && p.stock <= p.lowStockThreshold
    if (stockFilter === 'IN_STOCK') matchesStock = p.stock > p.lowStockThreshold

    return matchesSearch && matchesStock
  })

  // Auto-set operation based on movement type helper
  const handleTypeChange = (type: InventoryMovement) => {
    setAdjType(type)
    if (['PURCHASE', 'RETURN', 'TRANSFER'].includes(type)) setAdjOperation('add')
    if (['DAMAGED', 'EXPIRED', 'SALE'].includes(type)) setAdjOperation('subtract')
  }

  if (sessionStatus === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="sm:flex sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventory & Stock</h1>
            <p className="mt-2 text-sm text-gray-700">Track stock levels, record movements, and manage warehouse inventory.</p>
          </div>
          <div className="mt-4 sm:mt-0 flex gap-4">
            <Link href="/admin" className="text-sm font-medium text-red-600 hover:text-red-500 my-auto">
              &larr; Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm font-medium text-gray-500">Total Products Tracked</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{products.length}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg shadow-sm border border-red-100">
            <p className="text-sm font-medium text-red-800">Out of Stock</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{outOfStockCount}</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg shadow-sm border border-yellow-100">
            <p className="text-sm font-medium text-yellow-800">Low Stock Warning</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">{lowStockCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex flex-col sm:flex-row gap-4 border border-gray-200">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by Product Name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
            />
          </div>
          <div className="sm:w-48">
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
            >
              <option value="ALL">All Stock Levels</option>
              <option value="IN_STOCK">Healthy Stock</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
            </select>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product Details</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{product.name}</div>
                    <div className="text-xs text-gray-500">SKU: {product.sku || 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="text-sm font-bold text-gray-900">{product.stock}</div>
                    <div className="text-xs text-gray-500">Threshold: {product.lowStockThreshold}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {product.stock <= 0 ? (
                      <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Out of Stock</span>
                    ) : product.stock <= product.lowStockThreshold ? (
                      <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">Low Stock</span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">In Stock</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => openAdjustmentPanel(product)}
                      className="text-sm font-medium text-red-600 hover:text-red-900 border border-red-200 px-3 py-1.5 rounded-md hover:bg-red-50 transition-colors"
                    >
                      Adjust Stock
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Panel for Adjustments & History */}
      {selectedProduct && (
        <div className="fixed inset-0 overflow-hidden z-50">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setSelectedProduct(null)} />
            <div className="fixed inset-y-0 right-0 pl-10 max-w-md w-full flex">
              <div className="w-full h-full flex flex-col bg-white shadow-xl">
                
                {/* Header */}
                <div className="px-6 py-6 bg-red-600 text-white border-b">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-lg font-bold">{selectedProduct.name}</h2>
                      <p className="text-red-100 text-sm mt-1">SKU: {selectedProduct.sku || 'N/A'} | Current Stock: <strong>{selectedProduct.stock}</strong></p>
                    </div>
                    <button onClick={() => setSelectedProduct(null)} className="text-red-100 hover:text-white">
                      <span className="text-2xl">&times;</span>
                    </button>
                  </div>
                </div>

                {/* Form & History Body */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 bg-gray-50">
                  
                  {/* Adjustment Form */}
                  <form onSubmit={handleStockAdjustment} className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm space-y-4">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b pb-2">Record Movement</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Movement Type</label>
                        <select
                          value={adjType}
                          onChange={(e) => handleTypeChange(e.target.value as InventoryMovement)}
                          className="w-full text-sm border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                        >
                          <option value="PURCHASE">Purchase (Supplier)</option>
                          <option value="ADJUSTMENT">Manual Adjustment</option>
                          <option value="RETURN">Customer Return</option>
                          <option value="DAMAGED">Damaged/Lost</option>
                          <option value="EXPIRED">Expired</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Action</label>
                        <select
                          value={adjOperation}
                          onChange={(e) => setAdjOperation(e.target.value as 'add' | 'subtract')}
                          className="w-full text-sm border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                        >
                          <option value="add">+ Add Stock</option>
                          <option value="subtract">- Remove Stock</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Quantity (Absolute Number)</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={adjQuantity}
                        onChange={(e) => setAdjQuantity(parseInt(e.target.value))}
                        className="w-full text-sm border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                        placeholder="e.g. 50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Notes / Reason (Optional)</label>
                      <input
                        type="text"
                        value={adjNotes}
                        onChange={(e) => setAdjNotes(e.target.value)}
                        className="w-full text-sm border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                        placeholder="e.g. Batch #123 arrived from supplier"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting || !adjQuantity}
                      className="w-full bg-red-600 text-white font-medium py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {isSubmitting ? 'Updating...' : 'Update Stock & Log'}
                    </button>
                  </form>

                  {/* Audit History */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Recent Stock History</h3>
                    {isLoadingLogs ? (
                      <p className="text-sm text-gray-500 text-center py-4">Loading history...</p>
                    ) : productLogs.length === 0 ? (
                      <p className="text-sm text-gray-500 bg-white p-4 rounded border text-center border-dashed">No inventory logs found.</p>
                    ) : (
                      <div className="space-y-3">
                        {productLogs.map((log) => (
                          <div key={log.id} className="bg-white p-3 rounded-md border border-gray-200 text-sm flex justify-between items-center shadow-sm">
                            <div>
                              <p className="font-medium text-gray-900">{log.type}</p>
                              <p className="text-xs text-gray-500">{new Date(log.createdAt).toLocaleString()}</p>
                              {log.notes && <p className="text-xs text-gray-600 mt-1 truncate max-w-[200px]">Note: {log.notes}</p>}
                            </div>
                            <div className="text-right">
                              <p className={`font-bold ${log.newStock > log.oldStock ? 'text-green-600' : 'text-red-600'}`}>
                                {log.newStock > log.oldStock ? '+' : ''}{log.newStock - log.oldStock}
                              </p>
                              <p className="text-xs text-gray-500">{log.oldStock} &rarr; {log.newStock}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}