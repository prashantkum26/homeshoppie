'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  HeartIcon,
  ShoppingCartIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import useCartStore from '@/store/cartStore'
import toast from 'react-hot-toast'
import {
  getCategoryIcon,
  getCategoryImagePath,
} from '@/utils/imageUtil'

interface FeaturedProduct {
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
  const [isLiked, setIsLiked] = useState(false)
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
    e.stopPropagation()

    setIsLiked(!isLiked)
    toast.success(
      isLiked ? 'Removed from wishlist' : 'Added to wishlist'
    )
  }

  const discountPercent = product.compareAtPrice
    ? Math.round(
        ((product.compareAtPrice - product.price) /
          product.compareAtPrice) *
          100
      )
    : 0

  const categoryImage = getCategoryImagePath(
    product.category?.name || ''
  )

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-900/5">
      {/* Product Image Area */}
      <div className="relative h-48 sm:h-52 w-full bg-slate-50 overflow-hidden">
        <Link
          href={`/products/${product.id}`}
          aria-label={`View ${product.name}`}
          className="absolute inset-0 block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset"
        >
          <div className="absolute inset-0 h-full w-full bg-slate-100 flex items-center justify-center overflow-hidden">
            {product.images?.length ? (
              <img
                src={product.images[0]}
                alt={product.name}
                className="h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105"
                onError={(event) => {
                  const target = event.currentTarget
                  target.style.display = 'none'
                  const fallback = target.nextElementSibling as HTMLElement | null
                  if (fallback) {
                    fallback.style.display = 'flex'
                  }
                }}
              />
            ) : null}

            {/* Fallback Image / Icon */}
            <div className={`absolute inset-0 items-center justify-center bg-slate-100 ${product.images?.length ? 'hidden' : 'flex'}`}>
              {categoryImage ? (
                <img
                  src={categoryImage}
                  alt={product.category?.name || ''}
                  className="h-full w-full object-cover object-center"
                  onError={(event) => {
                    const target = event.currentTarget
                    target.style.display = 'none'
                    const fallback = target.nextElementSibling as HTMLElement | null
                    if (fallback) {
                      fallback.style.display = 'flex'
                    }
                  }}
                />
              ) : null}

              <div className={`absolute inset-0 items-center justify-center bg-primary-50/40 ${categoryImage ? 'hidden' : 'flex'}`}>
                <span className="text-4xl">
                  {getCategoryIcon(product.category?.name || '')}
                </span>
              </div>
            </div>
          </div>
        </Link>

        {/* Badges */}
        <div className="absolute left-3 top-3 z-10 flex flex-col gap-1 pointer-events-none">
          {discountPercent > 0 && (
            <span className="rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
              {discountPercent}% OFF
            </span>
          )}

          {!product.inStock && (
            <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              Sold out
            </span>
          )}
        </div>

        {/* Wishlist Button */}
        <button
          type="button"
          onClick={toggleLike}
          aria-label={
            isLiked
              ? `Remove ${product.name} from wishlist`
              : `Add ${product.name} to wishlist`
          }
          aria-pressed={isLiked}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/60 bg-white/90 text-slate-600 shadow-sm backdrop-blur-md transition-all duration-200 hover:scale-110 hover:bg-white hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          {isLiked ? (
            <HeartSolidIcon className="h-4 w-4 text-rose-600" aria-hidden="true" />
          ) : (
            <HeartIcon className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Product Content Body */}
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600">
            {product.category?.name || 'Featured'}
          </span>

          {product.inStock && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              In stock
            </span>
          )}
        </div>

        <Link
          href={`/products/${product.id}`}
          className="mt-2 group-hover:text-primary-600 transition-colors focus:outline-none"
        >
          <h3 className="line-clamp-1 text-sm sm:text-base font-semibold tracking-tight text-slate-900">
            {product.name}
          </h3>
        </Link>

        <p className="mt-1 line-clamp-2 text-xs text-slate-500 leading-relaxed">
          {product.description}
        </p>

        {product.tags && product.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {product.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Card Footer: Price & Add Button */}
        <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold tracking-tight text-slate-950">
                ₹{product.price}
              </span>

              {product.compareAtPrice && (
                <span className="text-xs text-slate-400 line-through">
                  ₹{product.compareAtPrice}
                </span>
              )}
            </div>

            {product.weight && product.unit && (
              <p className="text-[10px] font-medium text-slate-400">
                {product.weight} {product.unit}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              handleAddToCart(product)
            }}
            disabled={!product.inStock}
            className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
              product.inStock
                ? 'bg-primary-600 text-white shadow-sm hover:bg-primary-700'
                : 'cursor-not-allowed bg-slate-100 text-slate-400'
            }`}
          >
            <ShoppingCartIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{product.inStock ? 'Add' : 'Unavailable'}</span>
          </button>
        </div>
      </div>
    </article>
  )
}

export default function FeaturedProducts({
  featuredProducts,
}: {
  featuredProducts: FeaturedProduct[]
}) {
  return (
    <section className="bg-slate-50/50 py-16 sm:py-24 border-y border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-10">
          <div className="max-w-2xl space-y-2">
            <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] text-primary-600 bg-primary-50 px-3 py-1 rounded-full">
              Featured Collection
            </span>

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-950">
              Made with tradition. <span className="text-slate-600 font-semibold">Chosen for your home.</span>
            </h2>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
              Explore our most-loved homemade products, prepared using authentic traditional methods.
            </p>
          </div>

          <Link
            href="/products"
            className="group hidden sm:inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-primary-300 hover:bg-primary-50/30 hover:text-primary-700"
          >
            <span>View all products</span>
            <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </div>

        {/* Product Grid */}
        {featuredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
              <ShoppingCartIcon className="h-5 w-5" />
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-900">
              No featured products available
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
              We are currently restocking our curated collection. Check back soon!
            </p>
          </div>
        )}

        {/* Mobile View All CTA */}
        <div className="mt-8 flex justify-center sm:hidden">
          <Link
            href="/products"
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm"
          >
            <span>View all products</span>
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>

      </div>
    </section>
  )
}