'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { CheckCircleIcon, TruckIcon, ClockIcon, MapPinIcon } from '@heroicons/react/24/outline'
import useCartStore from '@/store/cartStore'

interface Order {
  id: string
  orderNumber: string
  totalAmount: number
  paymentMethod: string
  paymentStatus: string
  status: string
  createdAt: string
  orderItems: Array<{
    id: string
    name: string
    quantity: number
    price: number
  }>
  address: {
    name: string
    phone: string
    street: string
    city: string
    state: string
    pincode: string
  }
}

export default function OrderSuccessPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = searchParams.get('orderId')
  const { clearCart } = useCartStore()

  const [order, setOrder] = useState<Order | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (!orderId) {
      router.push('/dashboard')
      return
    }

    fetchOrder()
    // Clear cart on successful order
    clearCart()
  }, [status, orderId, router, clearCart])

  const fetchOrder = async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}`)
      
      if (response.ok) {
        const orderData = await response.json()
        setOrder(orderData)
      } else {
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Error fetching order:', error)
      router.push('/dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  const getEstimatedDelivery = () => {
    const orderDate = new Date(order?.createdAt || new Date())
    const deliveryDate = new Date(orderDate)
    
    // Add 3-7 business days for delivery
    if (order?.paymentMethod === 'cod') {
      deliveryDate.setDate(deliveryDate.getDate() + 7) // COD takes longer
    } else {
      deliveryDate.setDate(deliveryDate.getDate() + 5)
    }
    
    return deliveryDate.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'text-green-600 bg-green-50'
      case 'PENDING':
        return 'text-yellow-600 bg-yellow-50'
      case 'FAILED':
        return 'text-red-600 bg-red-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'text-green-600 bg-green-50'
      case 'PROCESSING':
        return 'text-blue-600 bg-blue-50'
      case 'SHIPPED':
        return 'text-purple-600 bg-purple-50'
      case 'DELIVERED':
        return 'text-green-600 bg-green-50'
      case 'PENDING':
        return 'text-yellow-600 bg-yellow-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600"></div>
      </div>
    )
  }

  if (!session || !order) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <CheckCircleIcon className="h-16 w-16 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {order.paymentMethod === 'cod' ? 'Order Placed Successfully!' : 'Payment Successful!'}
          </h1>
          <p className="text-lg text-gray-600">
            Thank you for your order. We've received your payment and your order is being processed.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Order #{order.orderNumber}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Status */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Status</h2>
              
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-600">Order Status</p>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getOrderStatusColor(order.status)}`}>
                    {order.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Payment Status</p>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPaymentStatusColor(order.paymentStatus)}`}>
                    {order.paymentStatus}
                  </span>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center text-sm text-gray-600">
                  <ClockIcon className="h-5 w-5 mr-2" />
                  <span>
                    Estimated delivery: <strong>{getEstimatedDelivery()}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Order Items */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Items</h2>
              
              <div className="space-y-4">
                {order.orderItems.map((item) => (
                  <div key={item.id} className="flex justify-between items-center py-3 border-b border-gray-100 last:border-b-0">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-900">{item.name}</h3>
                      <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 mt-4">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total Amount</span>
                  <span>₹{order.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Delivery Information */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Delivery Information</h2>
              
              <div className="flex items-start">
                <MapPinIcon className="h-5 w-5 text-gray-400 mt-1 mr-3" />
                <div>
                  <p className="text-sm text-gray-600 mb-1">Delivering to:</p>
                  <div className="text-sm text-gray-900">
                    <p className="font-medium">{order.address.name}</p>
                    <p>{order.address.phone}</p>
                    <p>{order.address.street}</p>
                    <p>{order.address.city}, {order.address.state}</p>
                    <p>{order.address.pincode}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Method</h2>
              
              <div className="text-sm text-gray-900">
                <p>
                  <strong>Method: </strong>
                  {order.paymentMethod === 'card' && 'Credit/Debit Card'}
                  {order.paymentMethod === 'upi' && 'UPI Payment'}
                  {order.paymentMethod === 'cod' && 'Cash on Delivery'}
                </p>
                {order.paymentMethod === 'cod' && (
                  <p className="text-yellow-600 mt-2">
                    Please keep ₹{order.totalAmount.toFixed(2)} ready for payment during delivery.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-lg shadow-sm sticky top-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">What's Next?</h2>
              
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircleIcon className="h-5 w-5 text-green-600" />
                    </div>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-gray-900">Order Confirmed</h3>
                    <p className="text-sm text-gray-500">Your order has been received and confirmed.</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <ClockIcon className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-gray-900">Processing</h3>
                    <p className="text-sm text-gray-500">We're preparing your items for shipment.</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                      <TruckIcon className="h-5 w-5 text-purple-600" />
                    </div>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-gray-900">On the Way</h3>
                    <p className="text-sm text-gray-500">Your order will be shipped soon.</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t space-y-3">
                <Link
                  href="/dashboard"
                  className="w-full bg-green-600 border border-transparent rounded-md shadow-sm py-2 px-4 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 text-center block"
                >
                  View Order History
                </Link>
                
                <Link
                  href="/products"
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm py-2 px-4 text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 text-center block"
                >
                  Continue Shopping
                </Link>
              </div>

              {/* Contact Support */}
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Need Help?</h3>
                <p className="text-sm text-gray-500 mb-3">
                  If you have any questions about your order, feel free to contact us.
                </p>
                <Link
                  href="/contact"
                  className="text-sm text-green-600 hover:text-green-500 font-medium"
                >
                  Contact Support →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
