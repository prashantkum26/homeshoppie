'use client'

import React, { useState, useEffect } from 'react'
import { useParams, notFound } from 'next/navigation'
import Link from 'next/link'
import { 
  HeartIcon, 
  ShoppingCartIcon, 
  StarIcon,
  ArrowLeftIcon,
  MinusIcon,
  PlusIcon,
  ShareIcon,
  CheckCircleIcon,
  TruckIcon,
  ShieldCheckIcon
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
  relatedProducts?: Array<{
    id: string
    slug?: string
    name: string
    price: number
    compareAt?: number | null
    discountPercent: number
    inStock: boolean
    category?: {
      name: string
    } | null
  }>
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

export default function ProductPage() {
  const params = useParams()
  const { id } = params
  
  const [product, setProduct] = useState<Product | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [isLiked, setIsLiked] = useState(false)
  const [activeTab, setActiveTab] = useState('description')
  const [loading, setLoading] = useState(true)
  
  const { addItem } = useCartStore()

  const fetchProduct = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/products/${id}`)
      if (!response.ok) {
        if (response.status === 404) {
          notFound()
          return
        }
        throw new Error('Failed to fetch product')
      }
      
      const data = await response.json()
      setProduct(data)
    } catch (error) {
      console.error('Error fetching product:', error)
      toast.error('Failed to load product')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) {
      fetchProduct()
    }
  }, [id])

  const handleAddToCart = () => {
    if (!product?.inStock) {
      toast.error('Product is out of stock')
      return
    }
    
    // Create cart item with proper Product structure for the store
    const productForCart = {
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      price: product.price,
      compareAt: product.compareAt ?? null,
      stock: product.stock,
      images: product.images || [],
      categoryId: product.category?.slug || 'general',
      isActive: true,
      weight: product.weight ?? null,
      unit: product.unit ?? null,
      tags: product.tags || [],
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    addItem(productForCart)
    toast.success(`Added ${quantity} ${quantity === 1 ? 'item' : 'items'} to cart!`)
  }

  const toggleLike = () => {
    setIsLiked(!isLiked)
    toast.success(isLiked ? 'Removed from wishlist' : 'Added to wishlist')
  }

  const handleShare = async () => {
    if (!product) return
    
    try {
      if (navigator.share) {
        await navigator.share({
          title: product.name,
          text: product.description,
          url: window.location.href,
        })
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(window.location.href)
        toast.success('Product link copied to clipboard!')
      }
    } catch (error) {
      console.error('Error sharing:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Product Not Found</h1>
          <Link href="/products" className="btn-primary px-6 py-3">
            Back to Products
          </Link>
        </div>
      </div>
    )
  }

  const displayWeight = product.weight 
    ? `${product.weight}${product.unit || 'g'}` 
    : product.unit || ''

  const tabs = [
    { id: 'description', label: 'Description' },
    { id: 'ingredients', label: 'Ingredients & Benefits' },
    { id: 'storage', label: 'Storage & Care' },
    { id: 'reviews', label: `Reviews` }
  ]

  return (
    <div className="bg-white min-h-screen">
      {/* Breadcrumb */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="container-custom py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Link href="/" className="hover:text-gray-800">Home</Link>
            <span>/</span>
            <Link href="/products" className="hover:text-gray-800">Products</Link>
            <span>/</span>
            <Link href={`/categories/${product.category?.slug || product.category?.name?.toLowerCase()}`} className="hover:text-gray-800">
              {product.category?.name}
            </Link>
            <span>/</span>
            <span className="text-gray-900">{product.name}</span>
          </div>
        </div>
      </div>

      <div className="container-custom py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Product Images */}
          <div>
            <div className="aspect-square bg-gray-100 rounded-lg mb-4 overflow-hidden relative">
              {product.images && product.images.length > 0 ? (
                // Display actual product image
                <img
                  src={product.images[selectedImageIndex]}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to placeholder icon if image fails to load
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    const fallback = target.nextElementSibling as HTMLElement
                    if (fallback) fallback.style.display = 'flex'
                  }}
                />
              ) : null}
              
              {/* Fallback placeholder - shown when no images or image fails to load */}
              <div 
                className={`absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center ${
                  product.images && product.images.length > 0 ? 'hidden' : 'flex'
                }`}
              >
                <span className="text-8xl">{getProductIcon(product.category?.name)}</span>
              </div>
              
              {product.discountPercent > 0 && (
                <div className="absolute top-4 left-4">
                  <span className="bg-red-500 text-white text-sm px-3 py-1 rounded">
                    -{product.discountPercent}% OFF
                  </span>
                </div>
              )}
              
              {!product.inStock && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                  <span className="bg-gray-800 text-white px-4 py-2 rounded-lg font-medium">
                    Out of Stock
                  </span>
                </div>
              )}
            </div>

            {/* Thumbnail Images - Show actual thumbnails when images exist */}
            {product.images && product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {product.images.map((imageUrl, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg overflow-hidden border-2 ${
                      selectedImageIndex === index ? 'border-primary-500' : 'border-transparent'
                    }`}
                  >
                    <img
                      src={`${imageUrl}?size=thumbnail`}
                      alt={`${product.name} thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to icon if thumbnail fails to load
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        const parent = target.parentElement as HTMLElement
                        parent.innerHTML = `<span class="text-2xl flex items-center justify-center w-full h-full">${getProductIcon(product.category?.name)}</span>`
                      }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Details */}
          <div>
            <div className="mb-6">
              <Link
                href="/products"
                className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Back to Products
              </Link>
              
              <div className="flex items-center gap-2 mb-2">
                {product.tags?.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs bg-primary-100 text-primary-800 px-2 py-1 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {product.name}
              </h1>
              
              <div className="flex items-center gap-2 mb-4">
                <span className={`text-sm px-3 py-1 rounded-full font-medium ${
                  product.inStock 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {product.inStock ? `In Stock (${product.stock} available)` : 'Out of Stock'}
                </span>
              </div>
              
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl font-bold text-gray-900">
                  ₹{product.price}
                </span>
                {product.compareAt && (
                  <>
                    <span className="text-xl text-gray-500 line-through">
                      ₹{product.compareAt}
                    </span>
                    <span className="bg-green-100 text-green-800 text-sm px-2 py-1 rounded">
                      Save ₹{product.compareAt - product.price}
                    </span>
                  </>
                )}
                {displayWeight && (
                  <span className="text-gray-600">• {displayWeight}</span>
                )}
              </div>
              
              <p className="text-gray-600 mb-6 leading-relaxed">
                {product.description}
              </p>
            </div>

            {/* Quantity and Add to Cart */}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center border border-gray-300 rounded-lg">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="p-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <MinusIcon className="h-4 w-4" />
                  </button>
                  <span className="px-4 py-2 text-lg font-medium">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(product.stock || 10, quantity + 1))}
                    disabled={quantity >= (product.stock || 10)}
                    className="p-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </div>
                
                <div className="text-sm text-gray-600">
                  Total: ₹{(product.price * quantity).toLocaleString()}
                </div>
              </div>

              <div className="flex gap-4 mb-6">
                <button
                  onClick={handleAddToCart}
                  disabled={!product.inStock}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-lg font-medium transition-colors ${
                    product.inStock
                      ? 'bg-primary-600 hover:bg-primary-700 text-white'
                      : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  }`}
                >
                  <ShoppingCartIcon className="h-5 w-5" />
                  {product.inStock ? 'Add to Cart' : 'Out of Stock'}
                </button>
                
                <button
                  onClick={toggleLike}
                  className="p-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  {isLiked ? (
                    <HeartSolidIcon className="h-6 w-6 text-red-500" />
                  ) : (
                    <HeartIcon className="h-6 w-6 text-gray-600" />
                  )}
                </button>
                
                <button 
                  onClick={handleShare}
                  className="p-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <ShareIcon className="h-6 w-6 text-gray-600" />
                </button>
              </div>

              {/* Product Features */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <TruckIcon className="h-5 w-5 text-green-600" />
                  <span>Free shipping on orders over ₹500</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <ShieldCheckIcon className="h-5 w-5 text-green-600" />
                  <span>100% authentic products</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircleIcon className="h-5 w-5 text-green-600" />
                  <span>30-day return policy</span>
                </div>
              </div>

              {/* Product Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Category:</span>
                    <span className="ml-2 font-medium">{product.category?.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Weight/Size:</span>
                    <span className="ml-2 font-medium">{displayWeight}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">SKU:</span>
                    <span className="ml-2 font-medium">{product.slug}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Stock:</span>
                    <span className="ml-2 font-medium">{product.stock} available</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Product Details Tabs */}
        <div className="mt-16">
          <div className="border-b border-gray-200">
            <div className="flex gap-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 text-lg font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="py-8">
            {activeTab === 'description' && (
              <div className="prose max-w-none">
                <h3 className="text-xl font-semibold mb-4">About This Product</h3>
                <p className="text-gray-600 leading-relaxed text-lg mb-6">
                  {product.description}
                </p>
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="font-semibold mb-3">Product Highlights</h4>
                  <ul className="space-y-2">
                    {product.tags?.map((tag, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <CheckCircleIcon className="h-4 w-4 text-green-600" />
                        <span className="text-gray-700">{tag}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {activeTab === 'ingredients' && (
              <div>
                <h3 className="text-xl font-semibold mb-4">Ingredients & Benefits</h3>
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                  <p className="text-yellow-800">
                    <strong>Natural & Pure:</strong> All our products are made with natural ingredients and traditional methods, ensuring authenticity and quality.
                  </p>
                </div>
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-semibold mb-3 text-gray-900">Key Features</h4>
                    <ul className="space-y-2">
                      {product.tags?.map((tag, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5" />
                          <span className="text-gray-600">{tag}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3 text-gray-900">Health Benefits</h4>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2">
                        <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5" />
                        <span className="text-gray-600">Made with traditional methods</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5" />
                        <span className="text-gray-600">No artificial preservatives</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5" />
                        <span className="text-gray-600">Rich in natural nutrients</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'storage' && (
              <div>
                <h3 className="text-xl font-semibold mb-4">Storage & Care Instructions</h3>
                <div className="space-y-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-2">Storage Guidelines</h4>
                    <p className="text-blue-800">Store in a cool, dry place away from direct sunlight. Keep the container tightly sealed after opening.</p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-2">Best Practices</h4>
                      <ul className="space-y-2 text-gray-600">
                        <li>• Use clean, dry utensils</li>
                        <li>• Avoid moisture contact</li>
                        <li>• Store at room temperature</li>
                        <li>• Keep away from strong odors</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Shelf Life</h4>
                      <p className="text-gray-600">
                        Best consumed within the expiry date mentioned on the packaging. 
                        Once opened, consume within the recommended time frame for optimal taste and quality.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div>
                <h3 className="text-xl font-semibold mb-4">Customer Reviews</h3>
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-gray-900 mb-2">Coming Soon</div>
                    <p className="text-gray-600">
                      We're working on implementing a comprehensive review system. 
                      Your feedback will help other customers make informed decisions.
                    </p>
                    <div className="mt-4 p-4 bg-white rounded-lg">
                      <p className="text-sm text-gray-500">
                        For now, you can contact us directly for any product questions or feedback.
                      </p>
                      <Link 
                        href="/contact" 
                        className="inline-block mt-2 text-primary-600 hover:text-primary-700 font-medium"
                      >
                        Contact Us →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Related Products */}
        {product.relatedProducts && product.relatedProducts.length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">Related Products</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {product.relatedProducts.map((relatedProduct) => (
                <Link
                  key={relatedProduct.id}
                  href={`/products/${relatedProduct.slug || relatedProduct.id}`}
                  className="group block"
                >
                  <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
                    <div className="aspect-square bg-gray-100 relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                        <span className="text-4xl">{getProductIcon(relatedProduct.category?.name)}</span>
                      </div>
                      {relatedProduct.discountPercent > 0 && (
                        <div className="absolute top-2 left-2">
                          <span className="bg-red-500 text-white text-xs px-2 py-1 rounded">
                            -{relatedProduct.discountPercent}%
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors line-clamp-2">
                        {relatedProduct.name}
                      </h3>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          relatedProduct.inStock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {relatedProduct.inStock ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-gray-900">
                          ₹{relatedProduct.price}
                        </span>
                        {relatedProduct.compareAt && (
                          <span className="text-sm text-gray-500 line-through">
                            ₹{relatedProduct.compareAt}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
