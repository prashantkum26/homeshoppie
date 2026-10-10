'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  HeartIcon,
  ShoppingCartIcon,
  ArrowLeftIcon,
  MinusIcon,
  PlusIcon,
  ShareIcon,
  CheckCircleIcon,
  TruckIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  ArchiveBoxIcon,
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import useCartStore from '@/store/cartStore'
import useWishlistStore from '@/store/wishlistStore'
import toast from 'react-hot-toast'

interface ProductCategory {
  id?: string
  name: string
  slug?: string
}

interface RelatedProduct {
  id: string
  slug?: string
  name: string
  price: number
  compareAtPrice?: number | null
  discountPercent?: number
  inStock: boolean
  images?: string[]
  category?: ProductCategory | null
}

interface Product {
  id: string
  slug: string
  name: string
  description: string
  price: number
  compareAtPrice?: number | null
  discountPercent?: number
  stock: number
  inStock: boolean
  images: string[]
  weight?: number | null
  unit?: string | null
  tags: string[]
  category?: ProductCategory | null
  relatedProducts?: RelatedProduct[]
}

type ProductTab = 'description' | 'details' | 'storage' | 'reviews'

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatPrice(price: number): string {
  return currencyFormatter.format(price)
}

function getProductIcon(categoryName?: string): string {
  const category = categoryName?.trim().toLowerCase()

  if (!category) return '📦'

  if (category.includes('ghee')) return '🧈'
  if (category.includes('oil')) return '🫒'
  if (category.includes('sweet')) return '🍪'
  if (category.includes('namkeen') || category.includes('snack')) return '🥨'
  if (category.includes('pooja') || category.includes('puja')) return '🪔'
  if (category.includes('rakhi')) return '🧵'
  if (category.includes('thekua')) return '🍪'
  if (category.includes('gujiya')) return '🥟'

  return '📦'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function normalizeCategory(value: unknown): ProductCategory | null {
  if (!isRecord(value) || typeof value.name !== 'string') {
    return null
  }

  return {
    name: value.name,
    ...(typeof value.id === 'string' ? { id: value.id } : {}),
    ...(typeof value.slug === 'string' ? { slug: value.slug } : {}),
  }
}

function normalizeProduct(value: unknown): Product | null {
  if (!isRecord(value)) return null

  if (
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.price !== 'number' ||
    !Number.isFinite(value.price) ||
    value.price < 0
  ) {
    return null
  }

  const stock =
    typeof value.stock === 'number' &&
      Number.isInteger(value.stock) &&
      value.stock >= 0
      ? value.stock
      : 0

  const images = Array.isArray(value.images)
    ? value.images.filter(
      (image): image is string =>
        typeof image === 'string' && image.trim().length > 0,
    )
    : []

  const tags = Array.isArray(value.tags)
    ? value.tags.filter(
      (tag): tag is string => typeof tag === 'string',
    )
    : []

  const relatedProducts: RelatedProduct[] = Array.isArray(
    value.relatedProducts,
  )
    ? value.relatedProducts.flatMap((item): RelatedProduct[] => {
      if (
        !isRecord(item) ||
        typeof item.id !== 'string' ||
        typeof item.name !== 'string' ||
        typeof item.price !== 'number' ||
        !Number.isFinite(item.price) ||
        item.price < 0
      ) {
        return []
      }

      const relatedImages = Array.isArray(item.images)
        ? item.images.filter(
          (image): image is string =>
            typeof image === 'string' && image.trim().length > 0,
        )
        : []

      const relatedStock =
        typeof item.stock === 'number' &&
          Number.isFinite(item.stock)
          ? item.stock
          : undefined

      const compareAtPrice =
        typeof item.compareAtPrice === 'number'
          ? item.compareAtPrice
          : null

      return [
        {
          id: item.id,
          name: item.name,
          price: item.price,
          inStock:
            typeof item.inStock === 'boolean'
              ? item.inStock
              : relatedStock !== undefined && relatedStock > 0,
          images: relatedImages,
          ...(typeof item.slug === 'string'
            ? { slug: item.slug }
            : {}),
          compareAtPrice,
          discountPercent:
            typeof item.discountPercent === 'number'
              ? item.discountPercent
              : 0,
          category: normalizeCategory(item.category),
        },
      ]
    })
    : []

  const compareAtPrice =
    typeof value.compareAtPrice === 'number' &&
      Number.isFinite(value.compareAtPrice)
      ? value.compareAtPrice
      : null

  return {
    id: value.id,
    slug: typeof value.slug === 'string' ? value.slug : value.id,
    name: value.name,
    description:
      typeof value.description === 'string' ? value.description : '',
    price: value.price,
    compareAtPrice,
    discountPercent:
      typeof value.discountPercent === 'number'
        ? value.discountPercent
        : 0,
    stock,
    inStock:
      typeof value.inStock === 'boolean'
        ? value.inStock && stock > 0
        : stock > 0,
    images,
    weight:
      typeof value.weight === 'number' ? value.weight : null,
    unit: typeof value.unit === 'string' ? value.unit : null,
    tags,
    category: normalizeCategory(value.category),
    relatedProducts,
  }
}

function getDiscount(product: {
  price: number
  compareAtPrice?: number | null
  discountPercent?: number
}): number {
  const compareAtPrice = product.compareAtPrice

  if (
    typeof compareAtPrice === 'number' &&
    compareAtPrice > product.price &&
    compareAtPrice > 0
  ) {
    return Math.round(
      ((compareAtPrice - product.price) / compareAtPrice) * 100,
    )
  }

  return Math.max(
    0,
    Math.min(100, product.discountPercent ?? 0),
  )
}

export default function ProductPage() {
  const params = useParams<{ id: string | string[] }>()
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [failedImages, setFailedImages] = useState<string[]>([])
  const [quantity, setQuantity] = useState(1)
  const [activeTab, setActiveTab] = useState<ProductTab>('description')
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  const { addItem } = useCartStore()

  const {
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
  } = useWishlistStore()

  const isLiked = product ? isInWishlist(product.id) : false

  const images = product?.images ?? []
  const selectedImage = images[selectedImageIndex]

  const displayWeight = useMemo(() => {
    if (product?.weight != null && product.weight > 0) {
      return `${product.weight}${product.unit || 'g'}`
    }

    return product?.unit || ''
  }, [product?.weight, product?.unit])

  const maxQuantity = product?.stock ?? 0

  const fetchProduct = useCallback(
    async (signal?: AbortSignal) => {
      if (!routeId) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setLoading(true)
      setFetchError(false)
      setNotFound(false)

      try {
        const response = await fetch(`/api/products/${routeId}`, {
          ...(signal ? { signal } : {}),
          headers: {
            Accept: 'application/json',
          },
          cache: 'no-store',
        })

        if (response.status === 404) {
          setProduct(null)
          setNotFound(true)
          return
        }

        if (!response.ok) {
          throw new Error(`Product request failed: ${response.status}`)
        }

        const responseData: unknown = await response.json()

        const candidate =
          isRecord(responseData) && 'product' in responseData
            ? responseData.product
            : responseData

        const normalized = normalizeProduct(candidate)

        if (!normalized) {
          throw new Error('Invalid product response')
        }

        setProduct(normalized)
        setSelectedImageIndex(0)
        setFailedImages([])
        setQuantity(normalized.stock > 0 ? 1 : 0)
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }

        console.error('Failed to fetch product:', error)
        setProduct(null)
        setFetchError(true)
      } finally {
        if (!signal?.aborted) {
          setLoading(false)
        }
      }
    },
    [routeId],
  )

  useEffect(() => {
    const controller = new AbortController()

    void fetchProduct(controller.signal)

    return () => controller.abort()
  }, [fetchProduct])

  const handleRetry = () => {
    void fetchProduct()
  }

  const handleQuantityChange = (nextQuantity: number) => {
    if (!product || maxQuantity <= 0) return

    setQuantity(Math.max(1, Math.min(maxQuantity, nextQuantity)))
  }

  const handleAddToCart = async () => {
    if (!product) return

    if (!product.inStock || product.stock <= 0) {
      toast.error('This product is currently out of stock.')
      return
    }

    if (quantity < 1 || quantity > product.stock) {
      toast.error('Please select a valid quantity.')
      return
    }

    setIsAddingToCart(true)

    try {
      const productForCart = {
        id: product.id,
        slug: product.slug,
        name: product.name,
        description: product.description,
        price: product.price,
        compareAtPrice: product.compareAtPrice ?? null,
        stock: product.stock,
        images: product.images,
        categoryId:
          product.category?.id ||
          product.category?.slug ||
          'general',
        isActive: true,
        weight: product.weight ?? null,
        unit: product.unit ?? null,
        tags: product.tags,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await addItem(productForCart, quantity)

      toast.success(
        `${quantity} ${quantity === 1 ? 'item' : 'items'} added to cart.`,
      )
    } catch (error) {
      console.error('Failed to add product to cart:', error)
      toast.error('Unable to add this product to your cart.')
    } finally {
      setIsAddingToCart(false)
    }
  }

  const toggleLike = () => {
    if (!product) return

    if (isLiked) {
      removeFromWishlist(product.id)
      toast.success('Removed from your wishlist.')
    } else {
      addToWishlist({
        id: product.id,
        name: product.name,
        price: product.price,
        images: product.images,
        ...(product.category?.name
          ? { category: product.category.name }
          : {}),
      })

      toast.success('Added to your wishlist.')
    }
  }

  const handleShare = async () => {
    if (!product || isSharing) return

    setIsSharing(true)

    try {
      const shareData = {
        title: product.name,
        text: product.description,
        url: window.location.href,
      }

      if (typeof navigator.share === 'function') {
        await navigator.share(shareData)
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareData.url)
        toast.success('Product link copied to clipboard.')
      } else {
        toast.error('Sharing is not supported on this browser.')
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }

      console.error('Unable to share product:', error)
      toast.error('Unable to share this product.')
    } finally {
      setIsSharing(false)
    }
  }

  const tabs: { id: ProductTab; label: string }[] = [
    { id: 'description', label: 'Description' },
    { id: 'details', label: 'Product details' },
    { id: 'storage', label: 'Storage & care' },
    { id: 'reviews', label: 'Reviews' },
  ]

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center bg-gray-50 px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-green-100 border-t-green-700" />
            <ShoppingBagIconFallback />
          </div>
          <p className="text-sm font-medium text-gray-600">
            Loading product details...
          </p>
        </div>
      </main>
    )
  }

  if (notFound) {
    return (
      <main className="flex min-h-[65vh] items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
            <ArchiveBoxIcon className="h-10 w-10 text-gray-500" />
          </div>

          <h1 className="mt-6 text-2xl font-bold text-gray-900">
            Product not found
          </h1>

          <p className="mt-3 text-sm leading-6 text-gray-500">
            This product may have been removed or is no longer available.
          </p>

          <Link
            href="/products"
            className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-green-700 px-5 py-3 font-semibold text-white transition hover:bg-green-800"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Browse products
          </Link>
        </div>
      </main>
    )
  }

  if (fetchError || !product) {
    return (
      <main className="flex min-h-[65vh] items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm sm:p-12">
          <ExclamationCircleIcon className="mx-auto h-12 w-12 text-red-500" />

          <h1 className="mt-5 text-2xl font-bold text-gray-900">
            Unable to load product
          </h1>

          <p className="mt-3 text-sm leading-6 text-gray-500">
            Something went wrong while loading this product. Please try again.
          </p>

          <button
            type="button"
            onClick={handleRetry}
            className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-green-700 px-5 py-3 font-semibold text-white transition hover:bg-green-800"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Try again
          </button>
        </div>
      </main>
    )
  }

  const discount = getDiscount(product)
  const hasValidComparePrice =
    product.compareAtPrice != null &&
    product.compareAtPrice > product.price

  return (
    <main className="min-h-screen bg-white">
      {/* Breadcrumb */}
      <div className="border-b border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-2 text-sm text-gray-500"
          >
            <Link href="/" className="hover:text-green-800">
              Home
            </Link>
            <span>/</span>
            <Link href="/products" className="hover:text-green-800">
              Products
            </Link>

            {product.category && (
              <>
                <span>/</span>
                {product.category.slug ? (
                  <Link
                    href={`/categories/${encodeURIComponent(product.category.slug)}`}
                    className="hover:text-green-800"
                  >
                    {product.category.name}
                  </Link>
                ) : (
                  <span>{product.category.name}</span>
                )}
              </>
            )}

            <span>/</span>
            <span
              aria-current="page"
              className="max-w-[200px] truncate font-medium text-gray-900"
            >
              {product.name}
            </span>
          </nav>
        </div>
      </div>

      {/* Main product */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2 lg:gap-14">
          {/* Gallery */}
          <div className="min-w-0">
            <div className="relative aspect-square overflow-hidden rounded-3xl border border-gray-100 bg-gradient-to-br from-gray-50 to-gray-100">
              {selectedImage &&
                !failedImages.includes(selectedImage) ? (
                <img
                  key={selectedImage}
                  src={selectedImage}
                  alt={product.name}
                  className="h-full w-full object-contain p-5 sm:p-10"
                  onError={() =>
                    setFailedImages((current) =>
                      current.includes(selectedImage)
                        ? current
                        : [...current, selectedImage],
                    )
                  }
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-4">
                  <span className="text-7xl sm:text-8xl">
                    {getProductIcon(product.category?.name)}
                  </span>
                  <p className="text-sm font-medium text-gray-500">
                    Product image unavailable
                  </p>
                </div>
              )}

              {discount > 0 && (
                <span className="absolute left-4 top-4 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white shadow-sm">
                  {discount}% OFF
                </span>
              )}

              <button
                type="button"
                onClick={toggleLike}
                aria-label={
                  isLiked
                    ? 'Remove from wishlist'
                    : 'Add to wishlist'
                }
                aria-pressed={isLiked}
                className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-gray-100 bg-white/95 text-gray-700 shadow-sm transition hover:scale-105 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                {isLiked ? (
                  <HeartSolidIcon className="h-6 w-6 text-red-500" />
                ) : (
                  <HeartIcon className="h-6 w-6" />
                )}
              </button>

              {!product.inStock && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <span className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-gray-900 shadow-lg">
                    Currently unavailable
                  </span>
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                {images.map((imageUrl, index) => (
                  <button
                    key={`${imageUrl}-${index}`}
                    type="button"
                    onClick={() => setSelectedImageIndex(index)}
                    aria-label={`View image ${index + 1}`}
                    aria-pressed={selectedImageIndex === index}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-gray-50 transition sm:h-20 sm:w-20 ${selectedImageIndex === index
                        ? 'border-green-700 ring-2 ring-green-100'
                        : 'border-gray-200 hover:border-green-300'
                      }`}
                  >
                    {!failedImages.includes(imageUrl) ? (
                      <img
                        src={imageUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-contain p-1"
                        onError={() =>
                          setFailedImages((current) =>
                            current.includes(imageUrl)
                              ? current
                              : [...current, imageUrl],
                          )
                        }
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-2xl">
                        {getProductIcon(product.category?.name)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Trust information */}
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-xl bg-green-50 p-3">
                <TruckIcon className="h-5 w-5 shrink-0 text-green-700" />
                <span className="text-xs font-medium leading-5 text-gray-700">
                  Shipping calculated at checkout
                </span>
              </div>

              <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                <ShieldCheckIcon className="h-5 w-5 shrink-0 text-green-700" />
                <span className="text-xs font-medium leading-5 text-gray-700">
                  Secure checkout
                </span>
              </div>

              <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                <CheckCircleIcon className="h-5 w-5 shrink-0 text-green-700" />
                <span className="text-xs font-medium leading-5 text-gray-700">
                  Product details available
                </span>
              </div>
            </div>
          </div>

          {/* Product information */}
          <div className="min-w-0">
            <Link
              href="/products"
              className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-green-800"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back to products
            </Link>

            {product.category && (
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-green-800">
                {product.category.name}
              </p>
            )}

            <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-900 sm:text-4xl">
              {product.name}
            </h1>

            {product.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {product.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Availability */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${product.inStock
                    ? 'bg-green-50 text-green-800'
                    : 'bg-red-50 text-red-700'
                  }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${product.inStock ? 'bg-green-600' : 'bg-red-500'
                    }`}
                />
                {product.inStock ? 'In stock' : 'Out of stock'}
              </span>

              {product.inStock && (
                <span className="text-sm text-gray-500">
                  {product.stock} available
                </span>
              )}
            </div>

            {/* Price */}
            <div className="mt-7 rounded-2xl border border-gray-100 bg-gray-50/80 p-5 sm:p-6">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                  {formatPrice(product.price)}
                </span>

                {hasValidComparePrice && (
                  <span className="text-lg text-gray-400 line-through">
                    {formatPrice(product.compareAtPrice!)}
                  </span>
                )}
              </div>

              {hasValidComparePrice && (
                <p className="mt-2 text-sm font-semibold text-green-800">
                  You save{' '}
                  {formatPrice(
                    product.compareAtPrice! - product.price,
                  )}{' '}
                  on this product
                </p>
              )}

              {displayWeight && (
                <p className="mt-3 text-sm text-gray-600">
                  Pack size:{' '}
                  <span className="font-semibold text-gray-900">
                    {displayWeight}
                  </span>
                </p>
              )}

              <p className="mt-2 text-xs leading-5 text-gray-500">
                Final payable amount and applicable delivery charges are
                confirmed at checkout.
              </p>
            </div>

            {/* Description */}
            <div className="mt-7">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-800">
                About this product
              </h2>

              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-gray-600 sm:text-base">
                {product.description ||
                  'Detailed product information will be available soon.'}
              </p>
            </div>

            {/* Quantity */}
            <div className="mt-8 border-t border-gray-200 pt-7">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Quantity
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {product.inStock
                      ? 'Choose how many you need.'
                      : 'Currently unavailable for purchase.'}
                  </p>
                </div>

                <div className="inline-flex items-center rounded-xl border border-gray-200 bg-white">
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(quantity - 1)}
                    disabled={!product.inStock || quantity <= 1}
                    aria-label="Decrease quantity"
                    className="flex h-11 w-11 items-center justify-center rounded-l-xl text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <MinusIcon className="h-4 w-4" />
                  </button>

                  <span
                    aria-live="polite"
                    className="min-w-12 text-center text-sm font-bold text-gray-900"
                  >
                    {quantity}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleQuantityChange(quantity + 1)}
                    disabled={
                      !product.inStock || quantity >= maxQuantity
                    }
                    aria-label="Increase quantity"
                    className="flex h-11 w-11 items-center justify-center rounded-r-xl text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Total */}
              <div className="mt-5 flex items-center justify-between rounded-xl bg-green-50 px-4 py-3">
                <span className="text-sm font-medium text-gray-700">
                  Subtotal
                </span>
                <span className="text-lg font-bold text-green-900">
                  {formatPrice(product.price * quantity)}
                </span>
              </div>

              {/* Purchase actions */}
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
                <button
                  type="button"
                  onClick={() => void handleAddToCart()}
                  disabled={!product.inStock || isAddingToCart}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-green-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 disabled:shadow-none"
                >
                  {isAddingToCart ? (
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  ) : (
                    <ShoppingCartIcon className="h-5 w-5" />
                  )}
                  {isAddingToCart
                    ? 'Adding to cart...'
                    : product.inStock
                      ? 'Add to Cart'
                      : 'Out of Stock'}
                </button>

                <button
                  type="button"
                  onClick={toggleLike}
                  aria-label={
                    isLiked ? 'Remove from wishlist' : 'Add to wishlist'
                  }
                  aria-pressed={isLiked}
                  className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 ${isLiked
                      ? 'border-red-200 bg-red-50 text-red-600'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  {isLiked ? (
                    <HeartSolidIcon className="h-5 w-5" />
                  ) : (
                    <HeartIcon className="h-5 w-5" />
                  )}
                  <span className="sm:hidden">Wishlist</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleShare()}
                  disabled={isSharing}
                  aria-label="Share product"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  {isSharing ? (
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  ) : (
                    <ShareIcon className="h-5 w-5" />
                  )}
                  <span className="ml-2 sm:hidden">Share</span>
                </button>
              </div>

              {product.inStock && (
                <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-gray-500">
                  <InformationCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  Availability and final pricing are subject to confirmation
                  when your order is placed.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Product information tabs */}
        <section className="mt-16 border-t border-gray-200 pt-10 sm:mt-20 sm:pt-14">
          <div className="border-b border-gray-200">
            <div
              role="tablist"
              aria-label="Product information"
              className="-mb-px flex gap-6 overflow-x-auto sm:gap-9"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`panel-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`shrink-0 border-b-2 px-1 py-4 text-sm font-semibold transition ${activeTab === tab.id
                      ? 'border-green-700 text-green-800'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div
            id={`panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeTab}`}
            className="min-h-48 py-8 sm:py-10"
          >
            {activeTab === 'description' && (
              <div className="max-w-3xl">
                <h2 className="text-xl font-bold text-gray-900">
                  Product description
                </h2>
                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-gray-600 sm:text-base">
                  {product.description ||
                    'Detailed product information will be available soon.'}
                </p>

                {product.tags.length > 0 && (
                  <div className="mt-7">
                    <h3 className="text-sm font-bold text-gray-900">
                      Product highlights
                    </h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {product.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-green-50 px-3 py-2 text-sm font-medium text-green-800"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'details' && (
              <div className="max-w-3xl">
                <h2 className="text-xl font-bold text-gray-900">
                  Product specifications
                </h2>

                <dl className="mt-5 divide-y divide-gray-100 rounded-2xl border border-gray-200">
                  {[
                    ['Product', product.name],
                    ['Category', product.category?.name || 'Not specified'],
                    ['Pack size', displayWeight || 'Not specified'],
                    ['Product code', product.slug],
                    [
                      'Availability',
                      product.inStock ? 'In stock' : 'Out of stock',
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="grid grid-cols-1 gap-1 px-4 py-4 sm:grid-cols-3 sm:gap-4"
                    >
                      <dt className="text-sm text-gray-500">{label}</dt>
                      <dd className="break-words text-sm font-medium text-gray-900 sm:col-span-2">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>

                <p className="mt-4 text-sm leading-6 text-gray-500">
                  For ingredients, allergens, nutrition information, and
                  product-specific instructions, refer to the product
                  packaging or contact our support team.
                </p>
              </div>
            )}

            {activeTab === 'storage' && (
              <div className="max-w-3xl">
                <h2 className="text-xl font-bold text-gray-900">
                  Storage and care
                </h2>

                <div className="mt-5 flex items-start gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-5">
                  <InformationCircleIcon className="mt-0.5 h-6 w-6 shrink-0 text-blue-700" />
                  <div>
                    <h3 className="font-semibold text-blue-950">
                      Follow the product instructions
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-blue-900">
                      Storage requirements and shelf life vary by product.
                      Please follow the instructions, expiry date, and
                      handling guidance on the original packaging.
                    </p>
                  </div>
                </div>

                <Link
                  href="/contact"
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-green-800 hover:text-green-900"
                >
                  Have a product question? Contact us
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="max-w-2xl rounded-2xl border border-gray-200 bg-gray-50 p-6 sm:p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm">
                  <InformationCircleIcon className="h-6 w-6 text-green-700" />
                </div>

                <h2 className="mt-4 text-xl font-bold text-gray-900">
                  Customer reviews
                </h2>

                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Product reviews are not available yet. We want to show
                  genuine customer feedback, so ratings will appear when
                  a review system is available.
                </p>

                <Link
                  href="/contact"
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-green-800 hover:text-green-900"
                >
                  Contact us about this product
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Related products */}
        {product.relatedProducts &&
          product.relatedProducts.length > 0 && (
            <section className="mt-10 border-t border-gray-200 pt-12 sm:mt-16 sm:pt-16">
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <span className="inline-flex rounded-full bg-green-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-green-800">
                    Curated for you
                  </span>

                  <h2 className="mt-3 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                    You may also love
                  </h2>

                  <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500 sm:text-base">
                    Discover more favourites from HomeShoppie.
                  </p>
                </div>

                <Link
                  href="/products"
                  className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-green-800 transition hover:text-green-950"
                >
                  Explore all products
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
                {product.relatedProducts.map((relatedProduct) => {
                  const relatedDiscount = getDiscount(relatedProduct)

                  const relatedHref = `/products/${encodeURIComponent(
                    relatedProduct.slug || relatedProduct.id,
                  )}`

                  return (
                    <article
                      key={relatedProduct.id}
                      className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-green-200 hover:shadow-lg"
                    >
                      <Link
                        href={relatedHref}
                        aria-label={`View ${relatedProduct.name}`}
                        className="relative block aspect-square overflow-hidden bg-gray-50"
                      >
                        {relatedProduct.images?.[0] ? (
                          <img
                            src={relatedProduct.images[0]}
                            alt={relatedProduct.name}
                            loading="lazy"
                            className="h-full w-full object-contain p-3 transition duration-500 group-hover:scale-105 sm:p-5"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-green-50 to-amber-50">
                            <span className="text-5xl">
                              {getProductIcon(
                                relatedProduct.category?.name,
                              )}
                            </span>
                          </div>
                        )}

                        {relatedDiscount > 0 && (
                          <span className="absolute left-2 top-2 rounded-md bg-red-600 px-2 py-1 text-[10px] font-bold text-white shadow-sm sm:left-3 sm:top-3 sm:text-xs">
                            {relatedDiscount}% OFF
                          </span>
                        )}

                        <span
                          className={`absolute bottom-2 left-2 rounded-full px-2 py-1 text-[10px] font-semibold sm:bottom-3 sm:left-3 sm:text-xs ${relatedProduct.inStock
                              ? 'bg-white/95 text-green-800'
                              : 'bg-gray-900/90 text-white'
                            }`}
                        >
                          {relatedProduct.inStock
                            ? 'In stock'
                            : 'Sold out'}
                        </span>
                      </Link>

                      <div className="flex flex-1 flex-col p-3 sm:p-4">
                        {relatedProduct.category?.name && (
                          <p className="mb-1 truncate text-[10px] font-semibold uppercase tracking-wider text-gray-500 sm:text-xs">
                            {relatedProduct.category.name}
                          </p>
                        )}

                        <Link href={relatedHref}>
                          <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-gray-900 transition group-hover:text-green-800 sm:text-base">
                            {relatedProduct.name}
                          </h3>
                        </Link>

                        <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span className="text-base font-bold text-gray-900 sm:text-lg">
                            {formatPrice(relatedProduct.price)}
                          </span>

                          {relatedProduct.compareAtPrice != null &&
                            relatedProduct.compareAtPrice >
                            relatedProduct.price && (
                              <span className="text-xs text-gray-400 line-through sm:text-sm">
                                {formatPrice(
                                  relatedProduct.compareAtPrice,
                                )}
                              </span>
                            )}
                        </div>

                        <Link
                          href={relatedHref}
                          className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-2 py-2 text-xs font-semibold text-white transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 sm:text-sm"
                        >
                          {relatedProduct.inStock
                            ? 'View product'
                            : 'View details'}
                          <ArrowRightIcon className="h-4 w-4 shrink-0" />
                        </Link>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )}
      </section>
    </main>
  )
}

function ShoppingBagIconFallback() {
  return (
    <ShoppingCartIcon className="h-7 w-7 text-green-700" />
  )
}