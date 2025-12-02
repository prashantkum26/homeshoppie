'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { 
  HeartIcon, 
  TrashIcon, 
  ShoppingCartIcon,
  StarIcon,
  EyeIcon
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid'
import useWishlistStore from '@/store/wishlistStore'
import useCartStore from '@/store/cartStore'

interface WishlistItem {
  id: string
  name: string
  price: number
  images?: string[]
  category?: string
}

export default function WishlistPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { items, removeFromWishlist, clearWishlist, fetchFromServer, isLoading } = useWishlistStore()
  const { addItem } = useCartStore()
  
  const [localItems, setLocalItems] = useState<WishlistItem[]>([])

  useEffect(() => {
    if (session?.user) {
      fetchFromServer()
    }
  }, [session?.user]) // Only depend on user session, not the function itself

  // Separate useEffect for updating local items
  useEffect(() => {
    setLocalItems(items)
  }, [items])

  const handleRemoveFromWishlist = (productId: string) => {
    removeFromWishlist(productId)
  }

  const handleAddToCart = (item: WishlistItem) => {
    addItem({
      id: item.id,
      name: item.name,
      price: item.price,
      images: item.images || [],
      description: '',
      compareAt: null,
      categoryId: '',
      stock: 0,
      isActive: true,
      slug: item.id,
      weight: null,
      unit: null,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date()
    })
    
    // Optionally remove from wishlist after adding to cart
    // removeFromWishlist(item.id)
  }

  const handleClearWishlist = () => {
    if (confirm('Are you sure you want to clear your wishlist?')) {
      clearWishlist()
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <HeartIconSolid className="h-8 w-8 text-red-500" />
              My Wishlist
            </h1>
            <p className="mt-2 text-gray-600">
              {localItems.length} {localItems.length === 1 ? 'item' : 'items'} in your wishlist
            </p>
          </div>
          
          {localItems.length > 0 && (
            <div className="mt-4 sm:mt-0 flex gap-3">
              <button
                onClick={handleClearWishlist}
                className="px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 flex items-center gap-2"
              >
                <TrashIcon className="h-4 w-4" />
                Clear All
              </button>
              <Link
                href="/products"
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
              >
                <ShoppingCartIcon className="h-4 w-4" />
                Continue Shopping
              </Link>
            </div>
          )}
        </div>

        {/* Auth Notice for Guests */}
        {!session && localItems.length > 0 && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <HeartIcon className="h-6 w-6 text-blue-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Save your wishlist permanently
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    Sign in to sync your wishlist across devices and never lose your favorite items.
                  </p>
                </div>
                <div className="mt-4">
                  <div className="-mx-2 -my-1.5 flex">
                    <Link
                      href="/auth/signin"
                      className="bg-blue-50 px-2 py-1.5 rounded-md text-sm font-medium text-blue-800 hover:bg-blue-100"
                    >
                      Sign In
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Wishlist Content */}
        {localItems.length === 0 ? (
          /* Empty Wishlist */
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="max-w-md mx-auto">
              <HeartIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                Your wishlist is empty
              </h3>
              <p className="text-gray-500 mb-6">
                Discover amazing products and add them to your wishlist to save for later.
              </p>
              <Link
                href="/products"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
              >
                <ShoppingCartIcon className="h-5 w-5 mr-2" />
                Start Shopping
              </Link>
            </div>
          </div>
        ) : (
          /* Wishlist Items Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {localItems.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden group hover:shadow-md transition-shadow"
              >
                {/* Product Image */}
                <div className="relative aspect-square bg-gray-100">
                  {item.images && item.images.length > 0 ? (
                    <Image
                      src={item.images[0]}
                      alt={item.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-gray-400 text-4xl">📷</div>
                    </div>
                  )}
                  
                  {/* Wishlist Remove Button */}
                  <button
                    onClick={() => handleRemoveFromWishlist(item.id)}
                    className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm hover:bg-white transition-colors"
                    title="Remove from wishlist"
                  >
                    <HeartIconSolid className="h-5 w-5 text-red-500" />
                  </button>
                  
                  {/* Quick Actions Overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="flex gap-2">
                      <Link
                        href={`/products/${item.id}`}
                        className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-50"
                        title="View product"
                      >
                        <EyeIcon className="h-5 w-5 text-gray-600" />
                      </Link>
                      <button
                        onClick={() => handleAddToCart(item)}
                        className="p-2 bg-green-600 text-white rounded-full shadow-sm hover:bg-green-700"
                        title="Add to cart"
                      >
                        <ShoppingCartIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Category Badge */}
                  {item.category && (
                    <div className="absolute top-3 left-3">
                      <span className="bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-medium text-gray-700">
                        {item.category}
                      </span>
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-900 line-clamp-2 flex-1">
                      <Link 
                        href={`/products/${item.id}`}
                        className="hover:text-green-600"
                      >
                        {item.name}
                      </Link>
                    </h3>
                  </div>
                  
                  {/* Price */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-gray-900">
                        ₹{item.price.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <StarIcon
                            key={i}
                            className={`h-4 w-4 ${
                              i < 4 ? 'text-yellow-400 fill-current' : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="ml-1 text-sm text-gray-500">(4.0)</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAddToCart(item)}
                      className="flex-1 bg-green-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-green-700 flex items-center justify-center gap-1"
                    >
                      <ShoppingCartIcon className="h-4 w-4" />
                      Add to Cart
                    </button>
                    <button
                      onClick={() => handleRemoveFromWishlist(item.id)}
                      className="px-3 py-2 border border-gray-300 text-gray-700 rounded-md text-sm hover:bg-gray-50"
                      title="Remove"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recommendations */}
        {localItems.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                You might also like
              </h2>
              <Link
                href="/products"
                className="text-green-600 hover:text-green-700 text-sm font-medium"
              >
                View all products →
              </Link>
            </div>
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <p className="text-gray-500">
                Check out our latest products and trending items
              </p>
              <Link
                href="/products"
                className="inline-flex items-center mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Browse Products
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
