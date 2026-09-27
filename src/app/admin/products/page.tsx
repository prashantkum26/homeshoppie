'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { 
  ArrowLeftIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PhotoIcon,
  CheckIcon,
  XMarkIcon,
  ArchiveBoxIcon,
  EyeSlashIcon,
  TagIcon
} from '@heroicons/react/24/outline'

interface ProductItem {
  id: string
  name: string
  slug: string
  description: string | null
  price: number
  compareAtPrice: number | null
  stock: number
  weight: number | null
  weightUnit: string | null
  tags: string[]
  images: string[]
  isActive: boolean
  createdAt: string
  category: {
    id: string
    name: string
  }
  _count?: {
    orderItems: number
  }
}

export default function AdminProductsPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [products, setProducts] = useState<ProductItem[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Quick edit modal / state
  const [editingStockId, setEditingStockId] = useState<string | null>(null)
  const [newStockVal, setNewStockVal] = useState<number>(0)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (sessionStatus === 'authenticated') {
      if (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPER_ADMIN') {
        toast.error('Access denied.')
        router.push('/dashboard')
        return
      }
      fetchInitialData()
    }
  }, [sessionStatus, router, session])

  const fetchInitialData = async () => {
    try {
      setIsLoading(true)
      const [prodRes, catRes] = await Promise.all([
        fetch('/api/admin/products'),
        fetch('/api/admin/categories')
      ])

      if (prodRes.ok) {
        const prodData = await prodRes.json()
        setProducts(prodData)
      } else {
        toast.error('Failed to load products')
      }

      if (catRes.ok) {
        const catData = await catRes.json()
        setCategories(catData)
      }
    } catch (error) {
      console.error('Fetch products error:', error)
      toast.error('Error fetching catalog data')
    } finally {
      setIsLoading(false)
    }
  }

  // Toggle Active/Inactive state
  const handleToggleActive = async (productId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus })
      })

      if (!response.ok) {
        throw new Error('Failed to update product status')
      }

      const updated = await response.json()
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, isActive: updated.isActive } : p))
      toast.success(`Product ${updated.isActive ? 'published to store' : 'hidden from store'}`)
    } catch (error) {
      toast.error('Could not update visibility')
    }
  }

  // Quick Stock Update directly from table
  const handleStockSave = async (productId: string) => {
    try {
      setIsUpdating(true)
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: Number(newStockVal) })
      })

      if (!response.ok) throw new Error('Failed to update stock')

      const updated = await response.json()
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock: updated.stock } : p))
      setEditingStockId(null)
      toast.success('Inventory level updated')
    } catch (error) {
      toast.error('Failed to update inventory')
    } finally {
      setIsUpdating(false)
    }
  }

  // Filter Logic
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          product.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (product.tags && product.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))

    const matchesCategory = categoryFilter === 'ALL' || product.category?.id === categoryFilter

    let matchesStatus = true
    if (statusFilter === 'ACTIVE') matchesStatus = product.isActive
    if (statusFilter === 'INACTIVE') matchesStatus = !product.isActive
    if (statusFilter === 'OUT_OF_STOCK') matchesStatus = product.stock <= 0

    return matchesSearch && matchesCategory && matchesStatus
  })

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
        
        {/* Top Header */}
        <div className="sm:flex sm:items-end sm:justify-between mb-8">
          <div>
            <Link 
              href="/admin" 
              className="inline-flex items-center text-sm font-bold text-gray-500 hover:text-gray-900 mb-3 transition group"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1 group-hover:-translate-x-1 transition-transform" />
              Back to Command Center
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Product Catalog</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage inventory, update pricing, and control catalog visibility.
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex gap-4 items-center">
            <Link
              href="/admin/products/new"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-bold rounded-lg shadow-sm text-white bg-red-600 hover:bg-red-700 transition"
            >
              <PlusIcon className="h-5 w-5 mr-1.5" />
              Add Product
            </Link>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="bg-white p-6 rounded-xl shadow-sm mb-6 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Search Catalog</label>
              <div className="relative">
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Product name, slug, or tag..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 text-sm border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Filter by Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 py-2"
              >
                <option value="ALL">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Stock & Visibility</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 py-2"
              >
                <option value="ALL">All Products</option>
                <option value="ACTIVE">Published (Live in Store)</option>
                <option value="INACTIVE">Hidden (Draft / Archived)</option>
                <option value="OUT_OF_STOCK">Out of Stock</option>
              </select>
            </div>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Product Info</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Pricing</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Inventory</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Orders</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Visibility</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <ArchiveBoxIcon className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                      <p className="text-sm font-bold text-gray-900">No products found</p>
                      <p className="text-sm text-gray-500 mt-1">Try adjusting your filters or search query.</p>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => {
                    const firstImage = product.images && product.images.length > 0 
                      ? product.images[0] 
                      : null

                    return (
                      <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                        
                        {/* Title & Thumbnail */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-12 w-12 flex-shrink-0 bg-gray-100 rounded-lg border border-gray-200 overflow-hidden flex items-center justify-center shadow-sm">
                              {firstImage ? (
                                <img
                                  src={firstImage.includes('?') ? `${firstImage}&size=thumbnail` : `${firstImage}?size=thumbnail`}
                                  alt={product.name}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" fill="%23f9fafb"><rect width="100%" height="100%" fill="%23f3f4f6"/></svg>'
                                  }}
                                />
                              ) : (
                                <PhotoIcon className="h-6 w-6 text-gray-300" />
                              )}
                            </div>
                            <div className="ml-4 max-w-xs">
                              <div className="text-sm font-bold text-gray-900 truncate" title={product.name}>
                                {product.name}
                              </div>
                              <div className="text-xs text-gray-500 font-mono truncate mt-0.5">
                                /{product.slug}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                            <TagIcon className="h-3 w-3 mr-1" />
                            {product.category?.name || 'Unassigned'}
                          </span>
                        </td>

                        {/* Price Details */}
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm font-bold text-gray-900">₹{product.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                          {product.compareAtPrice && product.compareAtPrice > product.price && (
                            <div className="text-xs font-medium text-gray-400 line-through mt-0.5">
                              ₹{product.compareAtPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                          )}
                        </td>

                        {/* Stock Quick-Edit */}
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {editingStockId === product.id ? (
                            <div className="flex items-center justify-center gap-1.5 animate-in fade-in duration-200">
                              <input
                                type="number"
                                min="0"
                                value={newStockVal}
                                onChange={(e) => setNewStockVal(Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-16 text-sm p-1 border-2 rounded-md border-red-500 text-center font-bold shadow-sm focus:ring-0 focus:outline-none"
                                autoFocus
                              />
                              <button
                                onClick={() => handleStockSave(product.id)}
                                disabled={isUpdating}
                                className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-md border border-emerald-200 transition"
                                title="Save Stock"
                              >
                                <CheckIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setEditingStockId(null)}
                                className="p-1.5 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-md border border-gray-200 transition"
                                title="Cancel"
                              >
                                <XMarkIcon className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                setEditingStockId(product.id)
                                setNewStockVal(product.stock)
                              }}
                              className="cursor-pointer group flex items-center justify-center gap-1.5 py-1 px-2 rounded hover:bg-gray-100 transition"
                              title="Click to update inventory"
                            >
                              <span className={`text-sm font-bold ${product.stock <= 0 ? 'text-red-600 bg-red-50 px-2 py-0.5 rounded' : 'text-gray-900'}`}>
                                {product.stock}
                              </span>
                              <PencilSquareIcon className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          )}
                        </td>

                        {/* Orders count */}
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="text-sm font-medium text-gray-600 bg-gray-50 px-3 py-1 rounded-md border border-gray-200">
                            {product._count?.orderItems || 0}
                          </span>
                        </td>

                        {/* Status Toggle */}
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleToggleActive(product.id, product.isActive)}
                            className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider border transition-colors ${
                              product.isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                            }`}
                            title={product.isActive ? "Click to Hide" : "Click to Publish"}
                          >
                            {!product.isActive && <EyeSlashIcon className="h-3 w-3 mr-1" />}
                            {product.isActive ? 'Published' : 'Hidden'}
                          </button>
                        </td>

                        {/* Action Links */}
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end">
                            <Link
                              href={`/admin/products/${product.id}/edit`}
                              className="inline-flex items-center text-gray-500 hover:text-red-600 font-semibold transition-colors bg-white hover:bg-red-50 p-2 rounded-md border border-transparent hover:border-red-100"
                              title="Edit Product"
                            >
                              <PencilSquareIcon className="h-5 w-5 mr-1" />
                              Edit
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}