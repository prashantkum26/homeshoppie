'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import {
  HeartIcon,
  TrashIcon,
  ShoppingCartIcon,
  StarIcon,
  EyeIcon,
  ArrowRightIcon,
  ArrowPathIcon,
  ShoppingBagIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid'
import useWishlistStore from '@/store/wishlistStore'
import useCartStore from '@/store/cartStore'

/**
 * Raw category data returned by an API or legacy persisted state.
 */
// interface WishlistCategory {
//   id?: string
//   name?: string
//   slug?: stringgit
// }

/**
 * Raw wishlist item. The category can be an object or a string.
 */
// interface RawWishlistItem {
//   id: string
//   name: string
//   price: number
//   images?: string[]
//   category?: string | WishlistCategory | null
// }

/**
 * Normalized item used by the UI.
 * category is always a string when present.
 */
interface WishlistItem {
  id: string
  name: string
  price: number
  images?: string[]
  category?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function normalizeWishlistItem(value: unknown): WishlistItem | null {
  if (!isRecord(value)) return null

  if (
    typeof value.id !== 'string' ||
    typeof value.name !== 'string'
  ) {
    return null
  }

  const rawCategory = value.category
  let category: string | undefined

  if (typeof rawCategory === 'string') {
    category = rawCategory
  } else if (isRecord(rawCategory)) {
    if (typeof rawCategory.name === 'string') {
      category = rawCategory.name
    }
  }

  const rawImages = value.images

  const images = Array.isArray(rawImages)
    ? rawImages.filter(
        (image): image is string =>
          typeof image === 'string' && image.trim().length > 0,
      )
    : []

  const price =
    typeof value.price === 'number' &&
    Number.isFinite(value.price) &&
    value.price >= 0
      ? value.price
      : 0

  return {
    id: value.id,
    name: value.name,
    price,
    images,
    ...(category !== undefined ? { category } : {}),
  }
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price)
}

export default function WishlistPage() {
  const { data: session, status } = useSession()

  const {
    items,
    removeFromWishlist,
    clearWishlist,
    fetchFromServer,
    isLoading,
  } = useWishlistStore()

  const { addItem } = useCartStore()

  const [isMounted, setIsMounted] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      void fetchFromServer()
    }
  }, [status, session?.user, fetchFromServer])

  /**
   * Normalize all store items before rendering.
   * This also protects the UI against legacy localStorage data.
   */
  const localItems = items
    .map((item) => normalizeWishlistItem(item))
    .filter((item): item is WishlistItem => item !== null)

  const handleRemoveFromWishlist = useCallback(
    async (productId: string) => {
      setActionError(null)
      setActionMessage(null)
      setRemovingId(productId)

      try {
        await Promise.resolve(removeFromWishlist(productId))
        setActionMessage('Item removed from your wishlist.')
      } catch (error) {
        console.error('Failed to remove wishlist item:', error)
        setActionError('Unable to remove this item. Please try again.')
      } finally {
        setRemovingId(null)
      }
    },
    [removeFromWishlist],
  )

  const handleAddToCart = useCallback(
    async (item: WishlistItem) => {
      setActionError(null)
      setActionMessage(null)
      setAddingId(item.id)

      try {
        addItem({
          id: item.id,
          name: item.name,
          price: item.price,
          images: item.images ?? [],
          description: '',
          compareAtPrice: null,
          categoryId: '',
          stock: 0,
          isActive: true,
          slug: item.id,
          weight: null,
          weightUnit: null,
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        setActionMessage(`${item.name} was added to your cart.`)
      } catch (error) {
        console.error('Failed to add wishlist item to cart:', error)
        setActionError('Unable to add this item to your cart.')
      } finally {
        setAddingId(null)
      }
    },
    [addItem],
  )

  const handleClearWishlist = useCallback(() => {
    if (localItems.length === 0) return

    const confirmed = window.confirm(
      'Are you sure you want to remove all items from your wishlist?',
    )

    if (!confirmed) return

    setActionError(null)
    setActionMessage(null)

    try {
      clearWishlist()
      setActionMessage('Your wishlist has been cleared.')
    } catch (error) {
      console.error('Failed to clear wishlist:', error)
      setActionError('Unable to clear your wishlist. Please try again.')
    }
  }, [clearWishlist, localItems.length])

  if (!isMounted || status === 'loading' || isLoading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center bg-gray-50 px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-green-100 border-t-green-600" />
            <HeartIconSolid className="h-7 w-7 text-green-600" />
          </div>

          <p className="text-sm font-medium text-gray-600">
            Loading your wishlist...
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <nav
            aria-label="Breadcrumb"
            className="mb-5 flex items-center gap-2 text-sm text-gray-500"
          >
            <Link href="/" className="transition hover:text-green-700">
              Home
            </Link>

            <span aria-hidden="true">/</span>

            <span className="font-medium text-gray-900">
              My Wishlist
            </span>
          </nav>

          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-50">
                <HeartIconSolid className="h-7 w-7 text-red-500" />
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                  My Wishlist
                </h1>

                <p className="mt-1 text-sm text-gray-500">
                  Keep the products you love close at hand.
                </p>
              </div>
            </div>

            {localItems.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-green-50 px-3 py-1.5 text-sm font-semibold text-green-800">
                  {localItems.length}{' '}
                  {localItems.length === 1 ? 'item' : 'items'} saved
                </span>

                <button
                  type="button"
                  onClick={handleClearWishlist}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                >
                  <TrashIcon className="h-4 w-4" />
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {/* Feedback */}
        {actionError && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <ExclamationCircleIcon className="h-5 w-5 shrink-0" />
            <p>{actionError}</p>
          </div>
        )}

        {actionMessage && (
          <div
            role="status"
            aria-live="polite"
            className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
          >
            {actionMessage}
          </div>
        )}

        {/* Guest sign-in notice */}
        {!session && localItems.length > 0 && (
          <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <HeartIcon className="mt-0.5 h-6 w-6 shrink-0 text-blue-600" />

              <div>
                <h2 className="font-semibold text-blue-950">
                  Keep your favourites safe
                </h2>

                <p className="mt-1 text-sm leading-6 text-blue-800">
                  Sign in to access your wishlist across devices.
                </p>
              </div>
            </div>

            <Link
              href="/auth/signin"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800"
            >
              Sign in
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        )}

        {localItems.length === 0 ? (
          /* Empty wishlist */
          <section className="rounded-3xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm sm:px-12 sm:py-20">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-green-50">
              <HeartIcon className="h-12 w-12 text-green-700" />
            </div>

            <h2 className="mt-7 text-2xl font-bold tracking-tight text-gray-900">
              Your wishlist is waiting
            </h2>

            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-gray-500 sm:text-base">
              You haven&apos;t saved any favourites yet. Explore HomeShoppie
              and save products you would love to buy later.
            </p>

            <Link
              href="/products"
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-green-700 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2"
            >
              <ShoppingBagIcon className="h-5 w-5" />
              Explore products
              <ArrowRightIcon className="h-4 w-4" />
            </Link>

            <div className="mt-8">
              <Link
                href="/categories"
                className="text-sm font-medium text-gray-600 underline decoration-gray-300 underline-offset-4 transition hover:text-green-700"
              >
                Browse categories
              </Link>
            </div>
          </section>
        ) : (
          <>
            {/* Product grid heading */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Your saved favourites
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Find something you love and make it yours.
                </p>
              </div>

              <Link
                href="/products"
                className="hidden items-center gap-1 text-sm font-semibold text-green-700 transition hover:text-green-800 sm:inline-flex"
              >
                Continue shopping
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>

            {/* Wishlist cards */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {localItems.map((item) => (
                <article
                  key={item.id}
                  className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
                >
                  {/* Product image */}
                  <div className="relative aspect-square overflow-hidden bg-gray-100">
                    {item.images?.[0] ? (
                      <Image
                        src={item.images[0]}
                        alt={item.name}
                        fill
                        className="object-cover transition duration-500 group-hover:scale-105"
                        sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 25vw"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-gray-400">
                        <ShoppingBagIcon className="h-12 w-12" />
                        <span className="text-xs">
                          Image unavailable
                        </span>
                      </div>
                    )}

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() =>
                        void handleRemoveFromWishlist(item.id)
                      }
                      disabled={removingId === item.id}
                      aria-label={`Remove ${item.name} from wishlist`}
                      title="Remove from wishlist"
                      className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-gray-100 bg-white/95 text-red-500 shadow-sm transition hover:bg-red-50 disabled:opacity-50"
                    >
                      {removingId === item.id ? (
                        <ArrowPathIcon className="h-5 w-5 animate-spin" />
                      ) : (
                        <HeartIconSolid className="h-5 w-5" />
                      )}
                    </button>

                    {/* Category badge: always a string */}
                    {item.category && (
                      <div className="absolute left-3 top-3 max-w-[65%] truncate rounded-lg border border-white/70 bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-sm">
                        {item.category}
                      </div>
                    )}

                    {/* Quick actions */}
                    <div className="absolute inset-x-0 bottom-0 flex translate-y-2 justify-center gap-3 bg-gradient-to-t from-black/40 to-transparent p-4 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
                      <Link
                        href={`/products/${encodeURIComponent(item.id)}`}
                        aria-label={`View ${item.name}`}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-800 shadow-md transition hover:bg-green-50 hover:text-green-700"
                      >
                        <EyeIcon className="h-5 w-5" />
                      </Link>

                      <button
                        type="button"
                        onClick={() => void handleAddToCart(item)}
                        disabled={addingId === item.id}
                        aria-label={`Add ${item.name} to cart`}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-green-700 text-white shadow-md transition hover:bg-green-800 disabled:opacity-50"
                      >
                        {addingId === item.id ? (
                          <ArrowPathIcon className="h-5 w-5 animate-spin" />
                        ) : (
                          <ShoppingCartIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Product details */}
                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-gray-900">
                      <Link
                        href={`/products/${encodeURIComponent(item.id)}`}
                        className="transition hover:text-green-700"
                      >
                        {item.name}
                      </Link>
                    </h3>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-lg font-bold text-gray-900">
                        {formatPrice(item.price)}
                      </span>

                      <div
                        className="flex items-center gap-1 text-xs text-gray-500"
                        aria-label="Customer rating not available"
                        title="Customer rating not available"
                      >
                        <StarIcon className="h-4 w-4 text-gray-300" />
                        <span>Not rated</span>
                      </div>
                    </div>

                    {/* Card actions */}
                    <div className="mt-auto flex gap-2 pt-5">
                      <button
                        type="button"
                        onClick={() => void handleAddToCart(item)}
                        disabled={addingId === item.id}
                        className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-green-700 px-3 py-3 text-sm font-semibold text-white transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {addingId === item.id ? (
                          <ArrowPathIcon className="h-4 w-4 shrink-0 animate-spin" />
                        ) : (
                          <ShoppingCartIcon className="h-4 w-4 shrink-0" />
                        )}

                        <span>
                          {addingId === item.id
                            ? 'Adding...'
                            : 'Add to cart'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void handleRemoveFromWishlist(item.id)
                        }
                        disabled={removingId === item.id}
                        aria-label={`Delete ${item.name}`}
                        title="Remove item"
                        className="inline-flex shrink-0 items-center justify-center rounded-xl border border-gray-200 px-3 text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        {removingId === item.id ? (
                          <ArrowPathIcon className="h-5 w-5 animate-spin" />
                        ) : (
                          <TrashIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/* Mobile shopping link */}
            <div className="mt-10 flex justify-center sm:hidden">
              <Link
                href="/products"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 font-semibold text-gray-800 transition hover:bg-gray-50"
              >
                Continue shopping
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </>
        )}

        {/* Shopping banner */}
        {localItems.length > 0 && (
          <section className="mt-12 overflow-hidden rounded-2xl bg-green-800 px-6 py-8 sm:px-9 sm:py-10">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-green-200">
                  A little something for you
                </p>

                <h2 className="mt-2 text-xl font-bold text-white sm:text-2xl">
                  Your next favourite is waiting.
                </h2>

                <p className="mt-2 max-w-lg text-sm leading-6 text-green-100">
                  Explore more of HomeShoppie&apos;s products and find
                  something special for your home.
                </p>
              </div>

              <Link
                href="/products"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-green-800 transition hover:bg-green-50"
              >
                Discover more
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}