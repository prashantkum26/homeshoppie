'use client'

import { useState } from 'react'
import Link from 'next/link'
import { HeartIcon, ShoppingCartIcon, StarIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import useCartStore from '@/store/cartStore'
import toast from 'react-hot-toast'
import { getCategoryIcon, getCategoryImagePath } from '@/utils/imageUtil'

interface FeaturedProduct {
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

interface ProductCardProps {
  product: FeaturedProduct
}

function ProductCard({ product }: ProductCardProps) {
  const [isLiked, setIsLiked] = useState<boolean>(false)
  const { addItem } = useCartStore()

  const handleAddToCart = (product: FeaturedProduct) => {
    if (!product.inStock) {
      toast.error('Product is out of stock')
      return
    }

    addItem({ ...product, quantity: 1 } as any)
    toast.success(`Added ${product.name} to cart!`)
  }

  const toggleLike = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setIsLiked(!isLiked)
    toast.success(isLiked ? 'Removed from wishlist' : 'Added to wishlist')
  }

  const discountPercent = product.compareAt
    ? Math.round(((product.compareAt - product.price) / product.compareAt) * 100)
    : 0

  return (
    <Link href={`/products/${product.id}`} className="group block">
      <div className="card hover:shadow-lg transition-shadow duration-300 relative overflow-hidden">
        {/* Product Image */}
        <div className="relative aspect-square bg-gray-100 rounded-lg mb-4 overflow-hidden">
          {product.images && product.images.length > 0 ? (
            // Display actual product image
            <img
              src={product.images[0]}
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
          {/* <div className={`absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center ${product.images && product.images.length > 0 ? 'hidden' : 'flex'}`}>
            <span className="text-6xl">{getCategoryIcon(product?.category?.name || "")}</span>
          </div> */}

          {!product.images?.length && (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
              {getCategoryImagePath(product?.category?.name || "") ? (
                <img
                  src={getCategoryImagePath(product?.category?.name || "")!}
                  alt={product?.category?.name || ""}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to emoji icon if image fails to load
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    const fallback = target.nextElementSibling as HTMLElement
                    if (fallback) fallback.style.display = 'flex'
                  }}
                />
              ) : null}
              {/* Fallback emoji - shown when no image or image fails to load */}
              <div
                className={`w-full h-full flex items-center justify-center ${getCategoryImagePath(product?.category?.name || "") ? 'hidden' : 'flex'
                  }`}
              >
                <span className="text-4xl">{getCategoryIcon(product?.category?.name || "")}</span>
              </div>
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {discountPercent > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded">
                -{discountPercent}%
              </span>
            )}
            {!product.inStock && (
              <span className="bg-gray-500 text-white text-xs px-2 py-1 rounded">
                Out of Stock
              </span>
            )}
          </div>

          {/* Wishlist Button */}
          <button
            onClick={toggleLike}
            className="absolute top-2 right-2 p-2 rounded-full bg-white/80 hover:bg-white transition-colors"
          >
            {isLiked ? (
              <HeartSolidIcon className="h-5 w-5 text-red-500" />
            ) : (
              <HeartIcon className="h-5 w-5 text-gray-600" />
            )}
          </button>

          {/* Quick Add to Cart (appears on hover) */}
          <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button
              onClick={(e) => {
                e.preventDefault()
                handleAddToCart(product)
              }}
              disabled={!product.inStock}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${product.inStock
                ? 'bg-primary-600 hover:bg-primary-700 text-white'
                : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                }`}
            >
              <ShoppingCartIcon className="h-4 w-4" />
              {product.inStock ? 'Add to Cart' : 'Out of Stock'}
            </button>
          </div>
        </div>

        {/* Product Info */}
        <div>

          <div className="mb-2">
            {/* <Link href={`/products/${product.slug || product.id}`}> */}
            <h3 className="text-sm font-medium text-gray-900 hover:text-primary-600 transition-colors line-clamp-2 mb-1">
              {product.name}
            </h3>
            {/* </Link> */}
            <p className="text-sm text-gray-600 line-clamp-2">
              {product.description}
            </p>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-gray-500">
              {product.category?.name}
            </span>
            <span className={`text-xs px-2 py-1 rounded ${product.inStock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
              {product.inStock ? 'In Stock' : 'Out of Stock'}
            </span>
          </div>

          <div className="flex items-center justify-between">
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

            <button
              onClick={(e) => {
                e.preventDefault()
                handleAddToCart(product)
              }}
              disabled={!product.inStock}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${product.inStock
                ? 'bg-primary-600 hover:bg-primary-700 text-white'
                : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                }`}
            >
              <ShoppingCartIcon className="h-4 w-4" />
              Add
            </button>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mb-3">
            {(product.tags || []).slice(0, 2).map((tag: string) => (
              <span
                key={tag}
                className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Price */}
          {/* <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-gray-900">
              ₹{product.price}
            </span>
            {product.compareAt && (
              <span className="text-sm text-gray-500 line-through">
                ₹{product.compareAt}
              </span>
            )}
          </div> */}
        </div>
      </div>
    </Link>
  )
}

export default function FeaturedProducts({ featuredProducts }: { featuredProducts: FeaturedProduct[] }) {
  return (
    <section className="py-16 bg-gray-50">
      <div className="container-custom">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Featured Products
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Handpicked premium products made with traditional methods and the finest ingredients
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredProducts.map((product: FeaturedProduct) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        <div className="text-center mt-12">
          <Link
            href="/products"
            className="btn-primary px-8 py-3 text-lg"
          >
            View All Products
          </Link>
        </div>
      </div>
    </section>
  )
}
