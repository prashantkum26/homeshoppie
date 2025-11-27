'use client'

import React, { useState, useEffect } from 'react'
import { useParams, notFound } from 'next/navigation'
import Link from 'next/link'
import { 
  HeartIcon, 
  ShoppingCartIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  Squares2X2Icon,
  ListBulletIcon,
  XMarkIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import useCartStore from '@/store/cartStore'
import toast from 'react-hot-toast'

interface Product {
  id: string
  slug: string
  name: string
  description: string
  price: number
  compareAt?: number | null
  discountPercent: number
  stock: number
  inStock: boolean
  images?: string[]
  weight?: number | null
  unit?: string | null
  tags?: string[]
  category?: {
    name: string
    slug: string
  } | null
}

interface Category {
  id: string
  name: string
  description: string
  slug: string
  image?: string
}

const getProductIcon = (categoryName?: string) => {
  switch (categoryName) {
    case 'Ghee': return '🧈'
    case 'Oils': return '🫒'
    case 'Sweets': return '🍪'
    case 'Namkeen': return '🥨'
    case 'Pooja Items': return '🪔'
    default: return '📦'
  }
}

const getCategoryColor = (categoryName?: string) => {
  switch (categoryName) {
    case 'Ghee': return 'from-yellow-100 to-yellow-200'
    case 'Oils': return 'from-green-100 to-green-200'
    case 'Sweets': return 'from-orange-100 to-orange-200'
    case 'Namkeen': return 'from-red-100 to-red-200'
    case 'Pooja Items': return 'from-pink-100 to-pink-200'
    default: return 'from-gray-100 to-gray-200'
  }
}

const sortOptions = [
  { name: 'Name A-Z', value: 'name-asc' },
  { name: 'Name Z-A', value: 'name-desc' },
  { name: 'Price: Low to High', value: 'price-asc' },
  { name: 'Price: High to Low', value: 'price-desc' },
  { name: 'Newest First', value: 'createdAt-desc' },
]

interface ProductCardProps {
  product: Product
  viewMode?: 'grid' | 'list'
}

function ProductCard({ product, viewMode = 'grid' }: ProductCardProps) {
  const [isLiked, setIsLiked] = useState(false)
  const { addItem } = useCartStore()

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!product.inStock) {
      toast.error('Product is out of stock')
      return
    }
    
    addItem({ ...product, quantity: 1 } as any)
    toast.success('Added to cart!')
  }

  const toggleLike = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsLiked(!isLiked)
    toast.success(isLiked ? 'Removed from wishlist' : 'Added to wishlist')
  }

  const displayWeight = product.weight 
    ? `${product.weight}${product.unit || 'g'}` 
    : product.unit || ''

  if (viewMode === 'list') {
    return (
      <Link href={`/products/${product.slug || product.id}`} className="group block">
        <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300 p-4 border border-gray-200">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-24 h-24 bg-gray-100 rounded-lg overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                <span className="text-2xl">{getProductIcon(product.category?.name)}</span>
              </div>
              {product.discountPercent > 0 && (
                <span className="absolute top-1 left-1 bg-red-500 text-white text-xs px-1 py-0.5 rounded">
                  -{product.discountPercent}%
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-primary-600 transition-colors">
                    {product.name}
                  </h3>
                  <p className="text-sm text-gray-500 mb-2 line-clamp-2">{product.description}</p>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      product.inStock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {product.inStock ? `In Stock (${product.stock})` : 'Out of Stock'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-2">
                    {product.tags?.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-gray-900">
                      ₹{product.price}
                    </span>
                    {product.compareAt && (
                      <span className="text-sm text-gray-500 line-through">
                        ₹{product.compareAt}
                      </span>
                    )}
                    <span className="text-sm text-gray-500">• {displayWeight}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={toggleLike}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    {isLiked ? (
                      <HeartSolidIcon className="h-5 w-5 text-red-500" />
                    ) : (
                      <HeartIcon className="h-5 w-5 text-gray-600" />
                    )}
                  </button>
                  <button
                    onClick={handleAddToCart}
                    disabled={!product.inStock}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      product.inStock
                        ? 'bg-primary-600 hover:bg-primary-700 text-white'
                        : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    {product.inStock ? 'Add to Cart' : 'Out of Stock'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link href={`/products/${product.slug || product.id}`} className="group block">
      <div className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 transform group-hover:scale-105 overflow-hidden">
        <div className="relative aspect-square bg-gray-100 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
            <span className="text-5xl">{getProductIcon(product.category?.name)}</span>
          </div>
          
          <div className="absolute top-3 left-3 flex flex-col gap-1">
            {product.discountPercent > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded">
                -{product.discountPercent}%
              </span>
            )}
            {!product.inStock && (
              <span className="bg-gray-500 text-white text-xs px-2 py-1 rounded">
                Out of Stock
              </span>
            )}
          </div>

          <button
            onClick={toggleLike}
            className="absolute top-3 right-3 p-2 rounded-full bg-white/80 hover:bg-white transition-colors"
          >
            {isLiked ? (
              <HeartSolidIcon className="h-5 w-5 text-red-500" />
            ) : (
              <HeartIcon className="h-5 w-5 text-gray-600" />
            )}
          </button>

          <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button
              onClick={handleAddToCart}
              disabled={!product.inStock}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                product.inStock
                  ? 'bg-primary-600 hover:bg-primary-700 text-white'
                  : 'bg-gray-400 text-gray-600 cursor-not-allowed'
              }`}
            >
              <ShoppingCartIcon className="h-4 w-4" />
              {product.inStock ? 'Add to Cart' : 'Out of Stock'}
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs px-2 py-1 rounded ${
              product.inStock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {product.inStock ? 'In Stock' : 'Out of Stock'}
            </span>
          </div>

          <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-primary-600 transition-colors">
            {product.name}
          </h3>
          
          <p className="text-sm text-gray-500 mb-2">{displayWeight}</p>
          
          <div className="flex flex-wrap gap-1 mb-3">
            {product.tags?.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-gray-900">
              ₹{product.price}
            </span>
            {product.compareAt && (
              <span className="text-sm text-gray-500 line-through">
                ₹{product.compareAt}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function CategoryPage() {
  const params = useParams()
  const { slug } = params
  
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('name-asc')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [onlyInStock, setOnlyInStock] = useState(false)
  const [category, setCategory] = useState<Category | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 0 })

  const fetchCategoryAndProducts = async () => {
    setLoading(true)
    try {
      // Fetch category details
      const categoryResponse = await fetch('/api/categories')
      if (!categoryResponse.ok) throw new Error('Failed to fetch categories')
      
      const categoryResult = await categoryResponse.json()
      // Handle the wrapped API response
      const categories = categoryResult.success ? categoryResult.data : []
      const foundCategory = categories.find((cat: Category) => cat.slug === slug)
      
      if (!foundCategory) {
        notFound()
        return
      }
      
      setCategory(foundCategory)

      // Fetch products for this category
      const params = new URLSearchParams({
        page: '1',
        limit: '50',
        categorySlug: slug as string,
        sortBy: sortBy.split('-')[0],
        sortOrder: sortBy.includes('-desc') ? 'desc' : 'asc',
        ...(searchQuery && { search: searchQuery }),
        ...(onlyInStock && { inStockOnly: 'true' })
      })

      const productsResponse = await fetch(`/api/products?${params}`)
      if (!productsResponse.ok) throw new Error('Failed to fetch products')
      
      const data = await productsResponse.json()
      setProducts(data.data || [])
      setPagination(data.pagination || { page: 1, total: 0, pages: 0 })
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load category data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategoryAndProducts()
  }, [slug])

  useEffect(() => {
    if (category) {
      const debounceTimer = setTimeout(() => {
        fetchCategoryAndProducts()
      }, searchQuery ? 500 : 0)

      return () => clearTimeout(debounceTimer)
    }
  }, [searchQuery, sortBy, onlyInStock])

  const clearFilters = () => {
    setSearchQuery('')
    setSortBy('name-asc')
    setOnlyInStock(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!category) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Category Not Found</h1>
          <Link href="/categories" className="btn-primary px-6 py-3">
            Back to Categories
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Hero Section */}
      <div className={`bg-gradient-to-r ${getCategoryColor(category.name)} py-16`}>
        <div className="container-custom">
          <div className="flex items-center mb-6">
            <Link
              href="/categories"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5" />
              Back to Categories
            </Link>
          </div>
          
          <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
            <div className="flex-shrink-0">
              <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-4xl">{getProductIcon(category.name)}</span>
              </div>
            </div>
            
            <div className="flex-1">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                {category.name}
              </h1>
              <p className="text-xl text-gray-700 max-w-2xl">
                {category.description}
              </p>
              <p className="mt-4 text-lg text-gray-600">
                {pagination.total} products available
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="container-custom py-6">
          <div className="mb-6">
            <div className="relative max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex items-center gap-4">
              <p className="text-gray-600">
                {loading ? 'Loading...' : `${products.length} products found`}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.name}
                  </option>
                ))}
              </select>

              <div className="flex border border-gray-300 rounded-md overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${
                    viewMode === 'grid'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Squares2X2Icon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${
                    viewMode === 'list'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <ListBulletIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-4 items-center">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={onlyInStock}
                onChange={(e) => setOnlyInStock(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="ml-2 text-sm text-gray-700">In Stock Only</span>
            </label>

            {(searchQuery || onlyInStock || sortBy !== 'name-asc') && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
              >
                <XMarkIcon className="h-4 w-4" />
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="container-custom py-12">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : products.length > 0 ? (
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
              : 'space-y-4'
          }>
            {products.map((product) => (
              <ProductCard key={product.id} product={product} viewMode={viewMode} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg mb-4">No products found matching your criteria</p>
            <button
              onClick={clearFilters}
              className="btn-primary px-6 py-3"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Call to Action */}
      <div className="bg-gray-50 py-16">
        <div className="container-custom text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Looking for Something Else?
          </h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Explore our other categories or contact us for custom requirements.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/categories"
              className="btn-primary px-6 py-3"
            >
              Browse All Categories
            </Link>
            <Link
              href="/contact"
              className="btn-secondary px-6 py-3"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
