'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { 
  ArrowLeftIcon, 
  TagIcon, 
  CurrencyRupeeIcon, 
  ArchiveBoxIcon, 
  PhotoIcon, 
  HashtagIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'
import ImageUploader from '@/components/ImageUploader'

interface Category {
  id: string
  name: string
  slug: string
}

interface Product {
  id: string
  name: string
  description: string
  price: number
  compareAtPrice: number | null
  stock: number
  weight: number
  unit: string
  tags: string[]
  categoryId: string
  isActive: boolean
  images: string[]
  slug: string
  category: {
    id: string
    name: string
  }
}

export default function EditProductPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const productId = params?.id as string
  
  const [product, setProduct] = useState<Product | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [tagInput, setTagInput] = useState('')
  
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated') {
      if (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPER_ADMIN') {
        router.push('/dashboard')
        toast.error('Access denied. Admin privileges required.')
        return
      }
      
      if (productId) {
        fetchProductAndCategories()
      }
    }
  }, [status, session, router, productId])

  const fetchProductAndCategories = async () => {
    try {
      setIsLoadingData(true)
      
      const productResponse = await fetch(`/api/admin/products/${productId}`)
      if (productResponse.ok) {
        const productData = await productResponse.json()
        setProduct(productData)
      } else {
        toast.error('Product not found')
        router.push('/admin/products')
        return
      }
      
      const categoriesResponse = await fetch('/api/categories')
      if (categoriesResponse.ok) {
        const categoriesData = await categoriesResponse.json()
        setCategories(categoriesData?.data || categoriesData);
      } else {
        toast.error('Failed to load categories')
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load data')
    } finally {
      setIsLoadingData(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (!product) return
    
    const { name, value, type } = e.target
    
    setProduct(prev => ({
      ...prev!,
      [name]: type === 'number' ? parseFloat(value) || 0 : 
              type === 'checkbox' ? (e.target as HTMLInputElement).checked : 
              value
    }))
  }

  const handleTagAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!product) return
    
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      const newTag = tagInput.trim().toLowerCase()
      
      if (!product.tags.includes(newTag)) {
        setProduct(prev => ({
          ...prev!,
          tags: [...prev!.tags, newTag]
        }))
      }
      
      setTagInput('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    if (!product) return
    
    setProduct(prev => ({
      ...prev!,
      tags: prev!.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const validateForm = () => {
    if (!product) return false
    
    if (!product.name.trim()) {
      toast.error('Product name is required')
      return false
    }
    
    if (!product.description.trim()) {
      toast.error('Product description is required')
      return false
    }
    
    if (product.price <= 0) {
      toast.error('Price must be greater than 0')
      return false
    }
    
    if (product.stock < 0) {
      toast.error('Stock cannot be negative')
      return false
    }
    
    if (!product.categoryId) {
      toast.error('Please select a category')
      return false
    }
    
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!product || !validateForm()) return
    
    setIsLoading(true)
    
    try {
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: product.name,
          description: product.description,
          price: product.price,
          compareAtPrice: product.compareAtPrice || null,
          stock: product.stock,
          weight: product.weight || null,
          unit: product.unit,
          tags: product.tags,
          categoryId: product.categoryId,
          isActive: product.isActive,
          images: product.images
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update product')
      }

      toast.success('Product updated successfully!')
      router.push('/admin/products')
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to update product')
    } finally {
      setIsLoading(false)
    }
  }

  if (status === 'loading' || isLoadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') || !product) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header & Back Button */}
        <div className="mb-8">
          <Link
            href="/admin/products"
            className="inline-flex items-center text-sm font-bold text-gray-500 hover:text-gray-900 mb-3 transition group"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1 group-hover:-translate-x-1 transition-transform" />
            Back to Product Catalog
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Edit Product</h1>
          <p className="mt-1 text-sm text-gray-500">
            Update specifications, pricing, inventory thresholds, and media assets.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-8 space-y-8">
            
            {/* Basic Information */}
            <div>
              <div className="flex items-center space-x-2 border-b pb-3 mb-5">
                <TagIcon className="h-5 w-5 text-red-600" />
                <h2 className="text-base font-bold text-gray-900">Basic Information</h2>
              </div>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={product.name}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-red-500 focus:border-red-500"
                    placeholder="e.g. Organic Farm Fresh Tomatoes"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                    Description *
                  </label>
                  <textarea
                    name="description"
                    required
                    rows={4}
                    value={product.description}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-red-500 focus:border-red-500"
                    placeholder="Provide detailed product features, benefits, and specifications..."
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                      Category *
                    </label>
                    <select
                      name="categoryId"
                      required
                      value={product.categoryId}
                      onChange={handleInputChange}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-red-500 focus:border-red-500"
                    >
                      <option value="">Select a category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex items-center pt-6">
                    <label className="relative flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="isActive"
                        id="isActive"
                        checked={product.isActive}
                        onChange={handleInputChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                      <span className="ml-3 text-sm font-bold text-gray-900">
                        {product.isActive ? 'Published (Live in Store)' : 'Hidden (Draft)'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="border-t pt-6">
              <div className="flex items-center space-x-2 border-b pb-3 mb-5">
                <CurrencyRupeeIcon className="h-5 w-5 text-red-600" />
                <h2 className="text-base font-bold text-gray-900">Pricing & Margins</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                    Selling Price (₹) *
                  </label>
                  <input
                    type="number"
                    name="price"
                    required
                    min="0"
                    step="0.01"
                    value={product.price}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-red-500 focus:border-red-500"
                    placeholder="0.00"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                    Compare At Price (₹)
                    <span className="text-gray-400 font-normal ml-1">(Optional - for discount tags)</span>
                  </label>
                  <input
                    type="number"
                    name="compareAtPrice"
                    min="0"
                    step="0.01"
                    value={product.compareAtPrice || ''}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-red-500 focus:border-red-500"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Inventory & Dimensions */}
            <div className="border-t pt-6">
              <div className="flex items-center space-x-2 border-b pb-3 mb-5">
                <ArchiveBoxIcon className="h-5 w-5 text-red-600" />
                <h2 className="text-base font-bold text-gray-900">Inventory & Units</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                    Stock Quantity *
                  </label>
                  <input
                    type="number"
                    name="stock"
                    min="0"
                    value={product.stock}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-red-500 focus:border-red-500"
                    placeholder="0"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                    Weight
                  </label>
                  <input
                    type="number"
                    name="weight"
                    min="0"
                    step="0.01"
                    value={product.weight || ''}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-red-500 focus:border-red-500"
                    placeholder="0.00"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                    Measurement Unit
                  </label>
                  <select
                    name="unit"
                    value={product.unit || 'KILOGRAMS'}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="KILOGRAMS">Kilogram (kg)</option>
                    <option value="GRAMS">Gram (g)</option>
                    <option value="POUNDS">Pound (lb)</option>
                    <option value="OUNCES">Ounce (oz)</option>
                    <option value="LITER">Liter (L)</option>
                    <option value="MILLILITER">Milliliter (mL)</option>
                    <option value="PIECE">Piece</option>
                    <option value="PACK">Pack</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Images Management */}
            <div className="border-t pt-6">
              <div className="flex items-center space-x-2 border-b pb-3 mb-5">
                <PhotoIcon className="h-5 w-5 text-red-600" />
                <h2 className="text-base font-bold text-gray-900">Media Assets</h2>
              </div>
              
              <ImageUploader
                productId={productId}
                existingImages={product.images}
                onImagesChange={(newImages: any) => {
                  setProduct(prev => ({
                    ...prev!,
                    images: newImages
                  }))
                }}
                maxImages={8}
                category="product"
              />
            </div>

            {/* Tags */}
            <div className="border-t pt-6">
              <div className="flex items-center space-x-2 border-b pb-3 mb-5">
                <HashtagIcon className="h-5 w-5 text-red-600" />
                <h2 className="text-base font-bold text-gray-900">Product Tags</h2>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                  Add Search Tags
                  <span className="text-gray-400 font-normal ml-1">(Press Enter to add tag)</span>
                </label>
                
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagAdd}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-red-500 focus:border-red-500"
                  placeholder="e.g. organic, fresh, bestseller"
                />
                
                {product.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {product.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-red-200 text-red-600 transition"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Form Actions Footer */}
          <div className="px-8 py-5 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <div className="text-xs text-gray-500 font-mono">
              Slug: <span className="text-gray-900">/{product.slug}</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <Link
                href="/admin/products"
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 transition shadow-sm"
              >
                Cancel
              </Link>
              
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center px-5 py-2 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition"
              >
                <CheckCircleIcon className="h-5 w-5 mr-1.5" />
                {isLoading ? 'Saving Changes...' : 'Update Product'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}