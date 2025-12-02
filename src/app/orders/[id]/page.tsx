'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { 
  ArrowLeftIcon,
  TruckIcon, 
  CheckCircleIcon, 
  ClockIcon, 
  XCircleIcon,
  MapPinIcon,
  CreditCardIcon,
  DevicePhoneMobileIcon,
  BanknotesIcon,
  PrinterIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

interface OrderDetail {
  id: string
  orderNumber: string
  totalAmount: number
  shippingFee: number
  paymentMethod: string
  paymentStatus: string
  status: string
  notes: string | null
  createdAt: string
  updatedAt: string
  orderItems: Array<{
    id: string
    name: string
    quantity: number
    unitPrice: number
    totalPrice: number
    productId: string
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

export default function OrderDetailsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const orderId = params?.id as string

  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/orders')
      return
    }

    if (!orderId) {
      router.push('/orders')
      return
    }

    fetchOrderDetails()
  }, [status, orderId, router])

  const fetchOrderDetails = async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}`)
      
      if (response.ok) {
        const orderData = await response.json()
        setOrder(orderData)
      } else if (response.status === 404) {
        router.push('/orders')
      } else {
        console.error('Failed to fetch order details')
        router.push('/orders')
      }
    } catch (error) {
      console.error('Error fetching order details:', error)
      router.push('/orders')
    } finally {
      setIsLoading(false)
    }
  }

  const getOrderProgress = (status: string) => {
    const steps = [
      { key: 'PENDING', label: 'Order Placed', description: 'Your order has been received' },
      { key: 'CONFIRMED', label: 'Order Confirmed', description: 'We have confirmed your order' },
      { key: 'PROCESSING', label: 'Processing', description: 'Your order is being prepared' },
      { key: 'SHIPPED', label: 'Shipped', description: 'Your order is on the way' },
      { key: 'DELIVERED', label: 'Delivered', description: 'Your order has been delivered' }
    ]

    const currentIndex = steps.findIndex(step => step.key === status)
    const isCancelled = status === 'CANCELLED'

    return steps.map((step, index) => ({
      ...step,
      completed: !isCancelled && index <= currentIndex,
      current: !isCancelled && index === currentIndex,
      cancelled: isCancelled && index > 0
    }))
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200'
      case 'CONFIRMED':
        return 'text-blue-700 bg-blue-50 border-blue-200'
      case 'PROCESSING':
        return 'text-blue-700 bg-blue-50 border-blue-200'
      case 'SHIPPED':
        return 'text-purple-700 bg-purple-50 border-purple-200'
      case 'DELIVERED':
        return 'text-green-700 bg-green-50 border-green-200'
      case 'CANCELLED':
        return 'text-red-700 bg-red-50 border-red-200'
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200'
    }
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

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'card':
        return <CreditCardIcon className="h-5 w-5" />
      case 'upi':
        return <DevicePhoneMobileIcon className="h-5 w-5" />
      case 'cod':
        return <BanknotesIcon className="h-5 w-5" />
      default:
        return <CreditCardIcon className="h-5 w-5" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getEstimatedDelivery = () => {
    if (!order) return ''
    
    const orderDate = new Date(order.createdAt)
    const deliveryDate = new Date(orderDate)
    
    // Add days based on payment method and current status
    if (order.status === 'DELIVERED') {
      return 'Delivered'
    } else if (order.status === 'CANCELLED') {
      return 'Order Cancelled'
    } else {
      if (order.paymentMethod === 'cod') {
        deliveryDate.setDate(deliveryDate.getDate() + 7)
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

  const orderProgress = getOrderProgress(order.status)
  const subtotal = order.totalAmount - (order.shippingFee || 0)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/orders"
                className="inline-flex items-center text-gray-500 hover:text-gray-700"
              >
                <ArrowLeftIcon className="h-5 w-5 mr-1" />
                Back to Orders
              </Link>
            </div>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <PrinterIcon className="h-4 w-4 mr-2" />
              Print Order
            </button>
          </div>
          
          <div className="mt-4">
            <h1 className="text-3xl font-bold text-gray-900">Order #{order.orderNumber}</h1>
            <div className="flex items-center space-x-4 mt-2">
              <p className="text-gray-600">Placed on {formatDate(order.createdAt)}</p>
              <div className={`inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium border ${getStatusColor(order.status)}`}>
                <span>{order.status}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Order Progress */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Order Progress</h2>
              
              {order.status === 'CANCELLED' ? (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="flex">
                    <XCircleIcon className="h-5 w-5 text-red-400 mt-0.5" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Order Cancelled</h3>
                      <p className="mt-1 text-sm text-red-700">
                        This order has been cancelled. If you have any questions, please contact our support team.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flow-root">
                  <ul className="-mb-8">
                    {orderProgress.map((step, stepIdx) => (
                      <li key={step.key}>
                        <div className="relative pb-8">
                          {stepIdx !== orderProgress.length - 1 && (
                            <span
                              className={`absolute top-4 left-4 -ml-px h-full w-0.5 ${
                                step.completed ? 'bg-green-600' : 'bg-gray-300'
                              }`}
                              aria-hidden="true"
                            />
                          )}
                          <div className="relative flex space-x-3">
                            <div>
                              <span
                                className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                                  step.completed
                                    ? 'bg-green-600'
                                    : step.current
                                    ? 'bg-blue-600'
                                    : 'bg-gray-300'
                                }`}
                              >
                                {step.completed ? (
                                  <CheckCircleIcon className="h-5 w-5 text-white" />
                                ) : step.current ? (
                                  <ClockIcon className="h-5 w-5 text-white" />
                                ) : (
                                  <div className="h-2.5 w-2.5 bg-white rounded-full" />
                                )}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1 pt-1.5">
                              <div>
                                <p className={`text-sm font-medium ${
                                  step.completed || step.current ? 'text-gray-900' : 'text-gray-500'
                                }`}>
                                  {step.label}
                                </p>
                                <p className="mt-1 text-sm text-gray-500">
                                  {step.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
                <div className="mt-6 pt-6 border-t">
                  <div className="flex items-center text-sm text-gray-600">
                    <TruckIcon className="h-5 w-5 mr-2" />
                    <span>
                      <strong>Estimated Delivery: </strong>
                      {getEstimatedDelivery()}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Order Items */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Items</h2>
              
              <div className="space-y-4">
                {order.orderItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-4 border-b border-gray-100 last:border-b-0">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0 w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                        </svg>
                      </div>
                      
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-gray-900">{item.name}</h3>
                        <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                        <p className="text-sm text-gray-500">Price: ₹{item.unitPrice.toFixed(2)} each</p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        ₹{item.totalPrice.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Notes */}
            {order.notes && (
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Notes</h2>
                <p className="text-gray-700">{order.notes}</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Order Summary */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span>Shipping</span>
                  <span className={order.shippingFee === 0 ? 'text-green-600' : ''}>
                    {order.shippingFee === 0 ? 'FREE' : `₹${order.shippingFee.toFixed(2)}`}
                  </span>
                </div>
                
                <div className="border-t pt-3 flex justify-between font-semibold">
                  <span>Total</span>
                  <span>₹{order.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Payment Information */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h2>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  {getPaymentIcon(order.paymentMethod)}
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {order.paymentMethod === 'card' && 'Credit/Debit Card'}
                      {order.paymentMethod === 'upi' && 'UPI Payment'}
                      {order.paymentMethod === 'cod' && 'Cash on Delivery'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Payment Status</span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${getPaymentStatusColor(order.paymentStatus)}`}>
                    {order.paymentStatus}
                  </span>
                </div>

                {order.paymentStatus === 'FAILED' && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <div className="flex">
                      <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">Payment Failed</h3>
                        <p className="mt-1 text-sm text-red-700">
                          Your payment could not be processed.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {order.paymentMethod === 'cod' && order.paymentStatus === 'PENDING' && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                    <p className="text-sm text-yellow-800">
                      Please keep ₹{order.totalAmount.toFixed(2)} ready for payment during delivery.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Delivery Address */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Delivery Address</h2>
              
              <div className="flex items-start space-x-3">
                <MapPinIcon className="h-5 w-5 text-gray-400 mt-1" />
                <div className="text-sm text-gray-900">
                  <p className="font-medium">{order.address.name}</p>
                  <p>{order.address.phone}</p>
                  <p className="mt-1">{order.address.street}</p>
                  <p>{order.address.city}, {order.address.state}</p>
                  <p>{order.address.pincode}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Need Help?</h2>
              
              <div className="space-y-3">
                <Link
                  href="/contact"
                  className="w-full bg-green-600 border border-transparent rounded-md shadow-sm py-2 px-4 text-base font-medium text-white hover:bg-green-700 text-center block"
                >
                  Contact Support
                </Link>
                
                <Link
                  href="/orders"
                  className="w-full bg-white border border-gray-300 rounded-md shadow-sm py-2 px-4 text-base font-medium text-gray-700 hover:bg-gray-50 text-center block"
                >
                  View All Orders
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
