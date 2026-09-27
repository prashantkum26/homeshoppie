'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

// Types based on Prisma Schema
interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  parentId: string | null
  sortOrder: number
  isActive: boolean
  isVisible: boolean
  parent?: {
    name: string
  } | null
  _count?: {
    products: number
    children: number
  }
}

export default function CategoryManagementPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Slide-over state for Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    parentId: '',
    sortOrder: 0,
    isActive: true,
    isVisible: true,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') router.push('/auth/signin')
    if (sessionStatus === 'authenticated') {
      if (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPER_ADMIN') {
        toast.error('Access denied.')
        router.push('/dashboard')
        return
      }
      fetchCategories()
    }
  }, [sessionStatus, router, session])

  const fetchCategories = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/admin/categories')
      if (!response.ok) throw new Error('Failed to fetch categories')
      setCategories(await response.json())
    } catch (error) {
      toast.error('Could not load categories')
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-generate slug from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    // Only auto-generate if we are creating a new category or slug is untouched
    if (!editingId) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
      setFormData(prev => ({ ...prev, name, slug }))
    } else {
      setFormData(prev => ({ ...prev, name }))
    }
  }

  const openCreateModal = () => {
    setEditingId(null)
    setFormData({
      name: '', slug: '', description: '', parentId: '', sortOrder: 0, isActive: true, isVisible: true
    })
    setIsModalOpen(true)
  }

  const openEditModal = (category: Category) => {
    setEditingId(category.id)
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      parentId: category.parentId || '',
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      isVisible: category.isVisible,
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setIsSubmitting(true)
      const url = editingId ? `/api/admin/categories/${editingId}` : '/api/admin/categories'
      const method = editingId ? 'PATCH' : 'POST'
      
      // Clean up empty string parentId to null for Prisma
      const payload = {
        ...formData,
        parentId: formData.parentId === '' ? null : formData.parentId
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save category')
      }
      
      toast.success(`Category ${editingId ? 'updated' : 'created'} successfully`)
      await fetchCategories()
      setIsModalOpen(false)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string, productCount: number, childCount: number) => {
    if (productCount > 0 || childCount > 0) {
      toast.error(`Cannot delete category with active products (${productCount}) or sub-categories (${childCount}).`)
      return
    }

    if (!confirm('Are you sure you want to delete this category? This action uses soft-delete.')) return

    try {
      const response = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete')
      toast.success('Category deleted')
      await fetchCategories()
    } catch (error) {
      toast.error('Failed to delete category')
    }
  }

  // Filter categories
  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
            <h1 className="text-2xl font-bold text-gray-900">Category Management</h1>
            <p className="mt-2 text-sm text-gray-700">Organize your store hierarchy and navigation menus.</p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center gap-4">
            <Link href="/admin" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              &larr; Dashboard
            </Link>
            <button 
              onClick={openCreateModal}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700"
            >
              + Create Category
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6 border border-gray-200">
          <input
            type="text"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:max-w-md text-sm border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
          />
        </div>

        {/* Table */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category Name & Slug</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parent Category</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Items</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredCategories.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No categories found.</td></tr>
              ) : (
                filteredCategories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-gray-900">{cat.name}</div>
                      <div className="text-xs text-gray-500 font-mono">/{cat.slug}</div>
                    </td>
                    <td className="px-6 py-4">
                      {cat.parent ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                          {cat.parent.name}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Root Category</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center text-sm">
                      <div className="text-gray-900 font-medium">{cat._count?.products || 0} Products</div>
                      {cat._count?.children ? <div className="text-xs text-gray-500 mt-1">{cat._count.children} Sub-cats</div> : null}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {cat.isActive ? 
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 w-fit">Active</span> : 
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 w-fit">Inactive</span>
                        }
                        {!cat.isVisible && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 w-fit">Hidden</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <button onClick={() => openEditModal(cat)} className="text-blue-600 hover:text-blue-900 mr-4">Edit</button>
                      <button onClick={() => handleDelete(cat.id, cat._count?.products || 0, cat._count?.children || 0)} className="text-red-600 hover:text-red-900">Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 overflow-hidden z-50">
          <div className="absolute inset-0 bg-gray-500 bg-opacity-75" onClick={() => setIsModalOpen(false)} />
          <div className="fixed inset-y-0 right-0 pl-10 max-w-md w-full flex">
            <div className="w-full h-full flex flex-col bg-white shadow-xl">
              
              <div className="px-6 py-6 bg-red-600 text-white border-b">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-bold">{editingId ? 'Edit Category' : 'Create Category'}</h2>
                  <button onClick={() => setIsModalOpen(false)} className="text-red-100 hover:text-white">
                    <span className="text-2xl">&times;</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6 bg-gray-50">
                <form onSubmit={handleSubmit} className="space-y-6 bg-white p-5 rounded-lg border shadow-sm">
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Category Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={handleNameChange}
                      className="mt-1 w-full text-sm border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">URL Slug *</label>
                    <input
                      type="text"
                      required
                      value={formData.slug}
                      onChange={(e) => setFormData({...formData, slug: e.target.value})}
                      className="mt-1 w-full text-sm border-gray-300 rounded-md bg-gray-50 focus:ring-red-500 focus:border-red-500 font-mono"
                    />
                    <p className="text-xs text-gray-500 mt-1">Must be unique (e.g. mobile-phones)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Parent Category</label>
                    <select
                      value={formData.parentId}
                      onChange={(e) => setFormData({...formData, parentId: e.target.value})}
                      className="mt-1 w-full text-sm border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                    >
                      <option value="">None (Top-Level Root Category)</option>
                      {categories.filter(c => c.id !== editingId).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <textarea
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="mt-1 w-full text-sm border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Display Sort Order</label>
                    <input
                      type="number"
                      value={formData.sortOrder}
                      onChange={(e) => setFormData({...formData, sortOrder: parseInt(e.target.value) || 0})}
                      className="mt-1 w-full text-sm border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Lower numbers appear first.</p>
                  </div>

                  <div className="space-y-3 pt-4 border-t">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                        className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-900">Category is Active</span>
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.isVisible}
                        onChange={(e) => setFormData({...formData, isVisible: e.target.checked})}
                        className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-900">Visible in store menus</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Category'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}