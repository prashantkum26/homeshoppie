'use client'

import { useState } from 'react'
import Link from 'next/link'
import { HeartIcon, ShoppingCartIcon, StarIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import useCartStore from '@/store/cartStore'
import toast from 'react-hot-toast'

interface FeaturedProduct {
  id: string
  name: string
  price: number
  compareAt: number | null
  rating: number
  reviews: number
  image: string
  category: string
  weight: string
  inStock: boolean
  tags: string[]
}

interface ProductCardProps {
  product: FeaturedProduct
}

// Sample featured products data
const featuredProducts: FeaturedProduct[] = [
  {
    id: '1',
    name: 'Pure Cow Ghee',
    price: 599,
    compareAt: 699,
    rating: 4.8,
    reviews: 124,
    image: '/images/cow-ghee.jpg',
    category: 'Ghee',
    weight: '500g',
    inStock: true,
    tags: ['Organic', 'Traditional']
  },
  {
    id: '2',
    name: 'Cold-Pressed Mustard Oil',
    price: 299,
    compareAt: 349,
    rating: 4.6,
    reviews: 89,
    image: '/images/mustard-oil.jpg',
    category: 'Oils',
    weight: '1L',
    inStock: true,
    tags: ['Cold-Pressed', 'Pure']
  },
  {
    id: '3',
    name: 'Traditional Thekua',
    price: 199,
    compareAt: null,
    rating: 4.9,
    reviews: 156,
    image: '/images/thekua.jpg',
    category: 'Sweets',
    weight: '250g',
    inStock: true,
    tags: ['Handmade', 'Festival Special']
  },
  {
    id: '4',
    name: 'Mixed Namkeen',
    price: 149,
    compareAt: 179,
    rating: 4.5,
    reviews: 67,
    image: '/images/namkeen.jpg',
    category: 'Namkeen',
    weight: '200g',
    inStock: false,
    tags: ['Crispy', 'Spicy']
  },
  {
    id: '5',
    name: 'Buffalo Ghee (Bilona)',
    price: 799,
    compareAt: 899,
    rating: 4.9,
    reviews: 234,
    image: '/images/buffalo-ghee.jpg',
    category: 'Ghee',
    weight: '500g',
    inStock: true,
    tags: ['Premium', 'Bilona Method']
  },
  {
    id: '6',
    name: 'Brass Diya Set',
    price: 399,
    compareAt: null,
    rating: 4.7,
    reviews: 45,
    image: '/images/diya-set.jpg',
    category: 'Pooja Items',
    weight: 'Set of 5',
    inStock: true,
    tags: ['Handcrafted', 'Brass']
  }
]

function ProductCard({ product }: ProductCardProps) {
  const [isLiked, setIsLiked] = useState<boolean>(false)
  const { addItem } = useCartStore()

  const handleAddToCart = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (!product.inStock) {
      toast.error('Product is out of stock')
      return
    }
    
    // Convert FeaturedProduct to Product format for cart
    const cartProduct = {
      id: product.id,
      name: product.name,
      slug: product.id, // Use id as slug for featured products
      description: null,
      price: product.price,
      originalPrice: product.compareAt,
      stock: product.inStock ? 999 : 0, // Assume high stock for featured products
      sku: null,
      images: [product.image],
      categoryId: product.category,
      featured: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    addItem(cartProduct)
    toast.success('Added to cart!')
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
          <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
            <span className="text-4xl">
              {product.category === 'Ghee' && '🧈'}
              {product.category === 'Oils' && '🫒'}
              {product.category === 'Sweets' && '🍪'}
              {product.category === 'Namkeen' && '🥨'}
              {product.category === 'Pooja Items' && '🪔'}
            </span>
          </div>
          
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

        {/* Product Info */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <StarIcon
                  key={i}
                  className={`h-4 w-4 ${
                    i < Math.floor(product.rating)
                      ? 'text-yellow-400 fill-current'
                      : 'text-gray-300'
                  }`}
                />
              ))}
              <span className="text-sm text-gray-600 ml-1">
                ({product.reviews})
              </span>
            </div>
          </div>

          <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-primary-600 transition-colors">
            {product.name}
          </h3>
          
          <p className="text-sm text-gray-500 mb-2">{product.weight}</p>
          
          {/* Tags */}
          <div className="flex flex-wrap gap-1 mb-3">
            {product.tags.slice(0, 2).map((tag: string) => (
              <span
                key={tag}
                className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Price */}
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

export default function FeaturedProducts() {
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
