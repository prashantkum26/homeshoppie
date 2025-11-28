'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'
import useCartStore from '@/store/cartStore'

export default function CartPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { items, updateQuantity, removeItem, clearCart, getTotal, getTotalItems } = useCartStore()
  const [isLoading, setIsLoading] = useState(false)

  const handleQuantityChange = (productId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      removeItem(productId)
      toast.success('Item removed from cart')
    } else {
      updateQuantity(productId, newQuantity)
    }
  }

  const handleRemoveItem = (productId: string, productName: string) => {
    removeItem(productId)
    toast.success(`${productName} removed from cart`)
  }

  const handleClearCart = () => {
    if (items.length === 0) return
    
    if (confirm('Are you sure you want to clear all items from your cart?')) {
      clearCart()
      toast.success('Cart cleared')
    }
  }

  const handleCheckout = () => {
    if (!session) {
      toast.error('Please sign in to checkout')
      router.push('/auth/signin?callbackUrl=/cart')
      return
    }

    if (items.length === 0) {
      toast.error('Your cart is empty')
      return
    }

    // Navigate to checkout page
    router.push('/checkout')
  }

  const subtotal = getTotal()
  const shippingFee = subtotal > 500 ? 0 : 50
  const total = subtotal + shippingFee

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center px-4">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-6 text-gray-300">
            <svg fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 4V2C7 1.45 7.45 1 8 1H16C16.55 1 17 1.45 17 2V4H20C20.55 4 21 4.45 21 5S20.55 6 20 6H19V19C19 20.1 18.1 21 17 21H7C5.9 21 5 20.1 5 19V6H4C3.45 6 3 5.55 3 5S3.45 4 4 4H7ZM9 3V4H15V3H9ZM7 6V19H17V6H7Z"/>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Your cart is empty</h2>
          <p className="text-gray-600 mb-8">Looks like you haven't added any items to your cart yet.</p>
          <Link
            href="/products"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Shopping Cart</h1>
                <p className="mt-1 text-sm text-gray-600">{getTotalItems()} item{getTotalItems() !== 1 ? 's' : ''} in your cart</p>
              </div>
              {items.length > 0 && (
                <button
                  onClick={handleClearCart}
                  className="text-sm text-red-600 hover:text-red-500"
                >
                  Clear Cart
                </button>
              )}
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {items.map((item) => (
              <div key={item.id} className="p-6 flex items-center space-x-6">
                <div className="flex-shrink-0 w-24 h-24 bg-gray-200 rounded-lg overflow-hidden">
                  {item.images && item.images.length > 0 ? (
                    <Image
                      src={item.images[0]}
                      alt={item.name}
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <Link href={`/products/${item.id}`} className="block">
                    <h3 className="text-lg font-medium text-gray-900 hover:text-green-600">
                      {item.name}
                    </h3>
                  </Link>
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                    {item.description}
                  </p>
                  {item.weight && item.unit && (
                    <p className="mt-1 text-sm text-gray-500">
                      Weight: {item.weight} {item.unit}
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex items-center border border-gray-300 rounded-md">
                    <button
                      onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                      className="p-2 hover:bg-gray-50 text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                    <span className="px-4 py-2 text-gray-900 font-medium">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                      className="p-2 hover:bg-gray-50 text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </button>
                  </div>

                  <div className="text-right min-w-[80px]">
                    <p className="text-lg font-semibold text-gray-900">
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-500">
                      ₹{item.price.toFixed(2)} each
                    </p>
                  </div>

                  <button
                    onClick={() => handleRemoveItem(item.id, item.name)}
                    className="p-2 text-red-600 hover:text-red-500"
                    title="Remove item"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 px-6 py-6">
            <div className="max-w-lg ml-auto">
              <div className="space-y-4">
                <div className="flex items-center justify-between text-base">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                
                <div className="flex items-center justify-between text-base">
                  <span>Shipping</span>
                  <span className={shippingFee === 0 ? 'text-green-600 font-medium' : ''}>
                    {shippingFee === 0 ? 'FREE' : `₹${shippingFee.toFixed(2)}`}
                  </span>
                </div>
                
                {subtotal < 500 && (
                  <p className="text-sm text-gray-600">
                    Add ₹{(500 - subtotal).toFixed(2)} more for free shipping
                  </p>
                )}
                
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between text-lg font-semibold">
                    <span>Total</span>
                    <span>₹{total.toFixed(2)}</span>
                  </div>
                </div>
                
                <button
                  onClick={handleCheckout}
                  disabled={isLoading}
                  className="w-full mt-6 bg-green-600 border border-transparent rounded-md shadow-sm py-3 px-4 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Processing...' : 'Proceed to Checkout'}
                </button>
                
                <Link
                  href="/products"
                  className="w-full mt-3 bg-white border border-gray-300 rounded-md shadow-sm py-3 px-4 text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 text-center block"
                >
                  Continue Shopping
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
