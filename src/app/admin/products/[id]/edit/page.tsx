'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { ArrowLeftIcon, PhotoIcon, TrashIcon } from '@heroicons/react/24/outline'
import ImageUploader from '../../../../../components/ImageUploader'
import { imageService } from '../../../../../lib/imageService'

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
  compareAt: number | null
  stock: number
  weight: number | null
  unit: string | null
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
  const [imageUrl, setImageUrl] = useState('')
  
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (status === 'authenticated') {
      if (session?.user?.role !== 'ADMIN') {
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
      
      // Fetch product details
      const productResponse = await fetch(`/api/admin/products/${productId}`)
      if (productResponse.ok) {
        const productData = await productResponse.json()
        setProduct(productData)
      } else {
        toast.error('Product not found')
        router.push('/admin')
        return
      }
      
      // Fetch categories
      const categoriesResponse = await fetch('/api/categories')
      if (categoriesResponse.ok) {
        const categoriesData = await categoriesResponse.json()
        setCategories(categoriesData?.data);
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

  const addImage = () => {
    if (!product || !imageUrl.trim()) return
    
    const url = imageUrl.trim()
    if (product.images.includes(url)) {
      toast.error('Image URL already exists')
      return
    }
    
    setProduct(prev => ({
      ...prev!,
      images: [...prev!.images, url]
    }))
    
    setImageUrl('')
    toast.success('Image added successfully')
  }

  const removeImage = (imageToRemove: string) => {
    if (!product) return
    
    setProduct(prev => ({
      ...prev!,
      images: prev!.images.filter(image => image !== imageToRemove)
    }))
    
    toast.success('Image removed successfully')
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
          compareAt: product.compareAt || null,
          stock: product.stock,
          weight: product.weight || null,
          unit: product.unit || null,
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
      router.push('/admin')
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to update product')
    } finally {
      setIsLoading(false)
    }
  }

  if (status === 'loading' || isLoadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-red-600"></div>
      </div>
    )
  }

  if (!session || session.user.role !== 'ADMIN' || !product) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <Link
              href="/admin"
              className="inline-flex items-center text-gray-500 hover:text-gray-700"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-1" />
              Back to Admin Dashboard
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Product</h1>
          <p className="mt-2 text-gray-600">
            Update product information and manage images.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white shadow-sm rounded-lg">
          <div className="px-6 py-8 space-y-6">
            
            {/* Basic Information */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={product.name}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                    placeholder="Enter product name"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Description *
                  </label>
                  <textarea
                    name="description"
                    required
                    rows={4}
                    value={product.description}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                    placeholder="Enter product description"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Category *
                  </label>
                  <select
                    name="categoryId"
                    required
                    value={product.categoryId}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="">Select a category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="isActive"
                    id="isActive"
                    checked={product.isActive}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                    Product is active (visible to customers)
                  </label>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Pricing</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Price (₹) *
                  </label>
                  <input
                    type="number"
                    name="price"
                    required
                    min="0"
                    step="0.01"
                    value={product.price}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                    placeholder="0.00"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Compare At Price (₹)
                    <span className="text-gray-500 text-xs ml-1">(Optional - for showing discounts)</span>
                  </label>
                  <input
                    type="number"
                    name="compareAt"
                    min="0"
                    step="0.01"
                    value={product.compareAt || ''}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Inventory */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Inventory</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Stock Quantity
                  </label>
                  <input
                    type="number"
                    name="stock"
                    min="0"
                    value={product.stock}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                    placeholder="0"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Weight
                  </label>
                  <input
                    type="number"
                    name="weight"
                    min="0"
                    step="0.01"
                    value={product.weight || ''}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                    placeholder="0.00"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Unit
                  </label>
                  <select
                    name="unit"
                    value={product.unit || 'kg'}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="kg">Kilogram (kg)</option>
                    <option value="g">Gram (g)</option>
                    <option value="l">Liter (l)</option>
                    <option value="ml">Milliliter (ml)</option>
                    <option value="piece">Piece</option>
                    <option value="pack">Pack</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Images Management */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Product Images</h2>
              <p className="text-sm text-gray-600 mb-4">
                Upload images for this product using our secure image service.
              </p>
              
              <ImageUploader
                productId={productId}
                existingImages={product.images}
                onImagesChange={(newImages) => {
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
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Tags</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Product Tags
                  <span className="text-gray-500 text-xs ml-1">(Press Enter to add)</span>
                </label>
                
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagAdd}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                  placeholder="Enter tags (e.g., organic, fresh, premium)"
                />
                
                {product.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {product.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-red-200 focus:outline-none"
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

          {/* Form Actions */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg flex items-center justify-between">
            <div className="text-sm text-gray-500">
              <p>Product Slug: <span className="font-mono">{product.slug}</span></p>
            </div>
            
            <div className="flex items-center space-x-4">
              <Link
                href="/admin"
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </Link>
              
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Updating...' : 'Update Product'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
