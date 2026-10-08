'use client'

import React, { useState, useEffect } from 'react'
import { useParams, notFound } from 'next/navigation'
import Link from 'next/link'
import { 
  HeartIcon, 
  ShoppingCartIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  ListBulletIcon,
  XMarkIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import useCartStore from '@/store/cartStore'
import toast from 'react-hot-toast'
import { getCategoryIcon, getCategoryImagePath } from '@/utils/imageUtil'

interface Product {
  id: string
  slug: string
  name: string
  description: string
  price: number
  compareAtPrice?: number | null
  discountPercent: number
  stock: number
  inStock: boolean
  images?: string[]
  weight?: number | null
  unit?: string | null
  weightUnit?: string | null
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

const getCategoryColor = (categoryName?: string) => {
  switch (categoryName) {
    case 'Ghee': return 'from-amber-50 to-amber-100/60 border-amber-200/60'
    case 'Oils': return 'from-emerald-50 to-emerald-100/60 border-emerald-200/60'
    case 'Sweets': return 'from-orange-50 to-orange-100/60 border-orange-200/60'
    case 'Namkeen': return 'from-rose-50 to-rose-100/60 border-rose-200/60'
    case 'Pooja Items': return 'from-purple-50 to-purple-100/60 border-purple-200/60'
    default: return 'from-slate-50 to-slate-100/60 border-slate-200/60'
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
    toast.success(`Added ${product.name} to cart!`)
  }

  const toggleLike = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsLiked(!isLiked)
    toast.success(isLiked ? 'Removed from wishlist' : 'Added to wishlist')
  }

  const categoryName = product.category?.name || (product as any).categoryName || ''
  
  const rawUnit = product.unit || product.weightUnit || ''
  const formattedUnit = rawUnit === 'KILOGRAMS' ? 'kg' : rawUnit === 'GRAMS' ? 'g' : rawUnit === 'LITER' ? 'L' : rawUnit === 'MILLILITER' ? 'ml' : rawUnit.toLowerCase()
  const displayWeight = product.weight ? `${product.weight}${formattedUnit}` : rawUnit

  const categoryImg = getCategoryImagePath(categoryName)
  const categoryIcn = getCategoryIcon(categoryName)
  const hasImages = product.images && product.images.length > 0 && !product.images[0].includes('dummy')

  if (viewMode === 'list') {
    return (
      <Link href={`/products/${product.slug || product.id}`} className="group block">
        <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 p-4 border border-slate-200/80">
          <div className="flex gap-4 items-center">
            <div className="flex-shrink-0 w-24 h-24 bg-slate-100 rounded-xl overflow-hidden relative flex items-center justify-center">
              {hasImages ? (
                <img
                  src={product.images![0]}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : categoryImg ? (
                <img
                  src={categoryImg}
                  alt={categoryName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl">{categoryIcn || '📦'}</span>
              )}
              {product.discountPercent > 0 && (
                <span className="absolute top-1 left-1 bg-rose-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                  -{product.discountPercent}%
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600">
                      {categoryName}
                    </span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      product.inStock ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {product.inStock ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-900 mb-1 group-hover:text-primary-600 transition-colors">
                    {product.name}
                  </h3>
                  <p className="text-xs text-slate-500 mb-2 line-clamp-1">{product.description}</p>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-slate-950">
                      ₹{product.price}
                    </span>
                    {product.compareAtPrice && product.compareAtPrice > product.price && (
                      <span className="text-xs text-slate-400 line-through">
                        ₹{product.compareAtPrice}
                      </span>
                    )}
                    {displayWeight && (
                      <span className="text-xs text-slate-400 ml-2">({displayWeight})</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleLike}
                    aria-label="Toggle wishlist"
                    className="p-2 rounded-full hover:bg-slate-100 transition-colors"
                  >
                    {isLiked ? (
                      <HeartSolidIcon className="h-5 w-5 text-rose-600" />
                    ) : (
                      <HeartIcon className="h-5 w-5 text-slate-400 hover:text-slate-600" />
                    )}
                  </button>
                  <button
                    onClick={handleAddToCart}
                    disabled={!product.inStock}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                      product.inStock
                        ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
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
    <Link href={`/products/${product.slug || product.id}`} className="group block h-full">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-slate-300 transition-all duration-300 flex flex-col h-full overflow-hidden">
        {/* Compact Image Container */}
        <div className="relative h-44 w-full bg-slate-50 overflow-hidden flex items-center justify-center">
          {hasImages ? (
            <img
              src={product.images![0]}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : categoryImg ? (
            <img
              src={categoryImg}
              alt={categoryName}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <span className="text-4xl">{categoryIcn || '📦'}</span>
          )}
          
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 z-10">
            {product.discountPercent > 0 && (
              <span className="bg-rose-600 text-white text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded shadow-sm">
                -{product.discountPercent}% OFF
              </span>
            )}
            {!product.inStock && (
              <span className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded">
                Out of Stock
              </span>
            )}
          </div>

          <button
            onClick={toggleLike}
            aria-label="Toggle wishlist"
            className="absolute top-2.5 right-2.5 z-10 p-2 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white transition-colors shadow-sm"
          >
            {isLiked ? (
              <HeartSolidIcon className="h-4 w-4 text-rose-600" />
            ) : (
              <HeartIcon className="h-4 w-4 text-slate-500 hover:text-slate-900" />
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 flex flex-1 flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600 truncate">
                {categoryName || 'Item'}
              </span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                product.inStock ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
              }`}>
                {product.inStock ? 'In Stock' : 'Out of Stock'}
              </span>
            </div>

            <h3 className="text-sm font-semibold text-slate-900 line-clamp-1 group-hover:text-primary-600 transition-colors mb-1">
              {product.name}
            </h3>
            
            <p className="text-xs text-slate-500 line-clamp-2 mb-2 leading-relaxed">
              {product.description}
            </p>

            {displayWeight && (
              <p className="text-[11px] font-medium text-slate-400 mb-2">Weight: {displayWeight}</p>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
            <div>
              <span className="text-base font-bold tracking-tight text-slate-950">
                ₹{product.price}
              </span>
              {product.compareAtPrice && product.compareAtPrice > product.price && (
                <span className="text-xs text-slate-400 line-through ml-1.5">
                  ₹{product.compareAtPrice}
                </span>
              )}
            </div>

            <button
              onClick={handleAddToCart}
              disabled={!product.inStock}
              className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                product.inStock
                  ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm shadow-primary-600/20'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <ShoppingCartIcon className="h-3.5 w-3.5" />
              <span>{product.inStock ? 'Add' : 'Unavailable'}</span>
            </button>
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

  useEffect(() => {
    let cancelled = false

    const fetchData = async () => {
      setLoading(true)

      try {
        const categoryResponse = await fetch('/api/categories')
        if (!categoryResponse.ok) throw new Error('Failed to fetch categories')

        const categoryResult = await categoryResponse.json()
        const categories = categoryResult.success ? categoryResult.data : categoryResult.categories || categoryResult || []

        const foundCategory = categories.find(
          (cat: Category) => cat.slug === slug
        )

        if (!foundCategory) {
          notFound()
          return
        }

        if (cancelled) return
        setCategory(foundCategory)

        const queryParams = new URLSearchParams({
          page: '1',
          limit: '50',
          categorySlug: slug as string,
          sortBy: sortBy.split('-')[0],
          sortOrder: sortBy.includes('-desc') ? 'desc' : 'asc',
          ...(searchQuery && { search: searchQuery }),
          ...(onlyInStock && { inStockOnly: 'true' }),
        })

        const productsResponse = await fetch(`/api/products?${queryParams}`)
        if (!productsResponse.ok) throw new Error('Failed to fetch products')

        const data = await productsResponse.json()
        if (cancelled) return

        setProducts(data.data || [])
        setPagination(data.pagination || { page: 1, total: 0, pages: 0 })
      } catch (error) {
        if (!cancelled) {
          console.error('Error fetching data:', error)
          toast.error('Failed to load category data')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const debounceTimer = setTimeout(fetchData, searchQuery ? 400 : 0)

    return () => {
      cancelled = true
      clearTimeout(debounceTimer)
    }
  }, [slug, searchQuery, sortBy, onlyInStock])

  const clearFilters = () => {
    setSearchQuery('')
    setSortBy('name-asc')
    setOnlyInStock(false)
  }

  if (loading && !category) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!category) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">Category Not Found</h1>
          <Link href="/categories" className="btn-primary px-6 py-2.5 text-sm rounded-xl">
            Back to Categories
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Hero Section */}
      <div className={`bg-gradient-to-r ${getCategoryColor(category.name)} py-12 sm:py-16 border-b border-slate-100`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <Link
              href="/categories"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-950 transition-colors uppercase tracking-wider"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              <span>Back to Categories</span>
            </Link>
          </div>
          
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex-shrink-0">
              <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-md overflow-hidden border border-white/80">
                {getCategoryImagePath(category.name) ? (
                  <img
                    src={getCategoryImagePath(category.name)!}
                    alt={category.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl">{getCategoryIcon(category.name)}</span>
                )}
              </div>
            </div>
            
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight mb-2">
                {category.name}
              </h1>
              <p className="text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
                {category.description}
              </p>
              <div className="mt-3 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white/80 backdrop-blur-sm text-slate-700 shadow-sm">
                {pagination.total} {pagination.total === 1 ? 'product' : 'products'} available
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Toolbar Bar */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
            
            {/* Search Input */}
            <div className="relative max-w-sm w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Search products in category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Controls & View Switcher */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center cursor-pointer bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/80">
                <input
                  type="checkbox"
                  checked={onlyInStock}
                  onChange={(e) => setOnlyInStock(e.target.checked)}
                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                />
                <span className="ml-2 text-xs font-medium text-slate-700">In Stock Only</span>
              </label>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Sort products by"
                className="border border-slate-200 bg-slate-50/50 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-primary-500 focus:bg-white focus:outline-none"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.name}
                  </option>
                ))}
              </select>

              <div className="flex border border-slate-200 bg-slate-50/50 rounded-xl overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid view"
                  className={`p-2 transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-primary-600 text-white'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Squares2X2Icon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  aria-label="List view"
                  className={`p-2 transition-colors ${
                    viewMode === 'list'
                      ? 'bg-primary-600 text-white'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <ListBulletIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {(searchQuery || onlyInStock || sortBy !== 'name-asc') && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
              <span className="text-xs text-slate-500">Active filters:</span>
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
              >
                <XMarkIcon className="h-3.5 w-3.5" />
                <span>Reset all</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          </div>
        ) : products.length > 0 ? (
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'
              : 'space-y-3 max-w-3xl mx-auto'
          }>
            {products.map((product) => (
              <ProductCard key={product.id} product={product} viewMode={viewMode} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
            <p className="text-slate-600 font-medium text-base mb-3">No products found matching your criteria</p>
            <button
              onClick={clearFilters}
              className="btn-primary px-5 py-2 text-xs rounded-xl shadow-sm"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Call to Action */}
      <div className="bg-slate-50 border-t border-slate-100 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Looking for Something Else?
          </h2>
          <p className="text-sm text-slate-600 mb-6 max-w-lg mx-auto">
            Explore our other handcrafted categories or contact us for custom orders.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/categories"
              className="btn-primary px-6 py-3 text-xs font-semibold rounded-xl shadow-md shadow-primary-600/20"
            >
              Browse All Categories
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center px-6 py-3 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}