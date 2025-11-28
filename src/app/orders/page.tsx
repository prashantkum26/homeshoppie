'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { 
  EyeIcon, 
  TruckIcon, 
  CheckCircleIcon, 
  ClockIcon, 
  XCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

interface Order {
  id: string
  orderNumber: string
  totalAmount: number
  paymentMethod: string
  paymentStatus: string
  status: string
  createdAt: string
  updatedAt: string
  orderItems: Array<{
    id: string
    name: string
    quantity: number
    price: number
  }>
  address: {
    name: string
    street: string
    city: string
    state: string
    pincode: string
  }
}

export default function OrdersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/orders')
      return
    }

    fetchOrders()
  }, [status, router])

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/orders')
      
      if (response.ok) {
        const ordersData = await response.json()
        setOrders(ordersData)
      } else {
        console.error('Failed to fetch orders')
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <ClockIcon className="h-5 w-5 text-yellow-600" />
      case 'CONFIRMED':
        return <CheckCircleIcon className="h-5 w-5 text-blue-600" />
      case 'PROCESSING':
        return <ClockIcon className="h-5 w-5 text-blue-600" />
      case 'SHIPPED':
        return <TruckIcon className="h-5 w-5 text-purple-600" />
      case 'DELIVERED':
        return <CheckCircleIcon className="h-5 w-5 text-green-600" />
      case 'CANCELLED':
        return <XCircleIcon className="h-5 w-5 text-red-600" />
      default:
        return <ClockIcon className="h-5 w-5 text-gray-600" />
    }
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

  const getPaymentStatusIcon = (status: string) => {
    switch (status) {
      case 'PAID':
        return <CheckCircleIcon className="h-4 w-4 text-green-600" />
      case 'PENDING':
        return <ClockIcon className="h-4 w-4 text-yellow-600" />
      case 'FAILED':
        return <XCircleIcon className="h-4 w-4 text-red-600" />
      default:
        return <ExclamationTriangleIcon className="h-4 w-4 text-gray-600" />
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

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true
    if (filter === 'pending') return order.status === 'PENDING' || order.status === 'CONFIRMED'
    if (filter === 'processing') return order.status === 'PROCESSING' || order.status === 'SHIPPED'
    if (filter === 'completed') return order.status === 'DELIVERED'
    if (filter === 'cancelled') return order.status === 'CANCELLED'
    if (filter === 'payment-failed') return order.paymentStatus === 'FAILED'
    return true
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600"></div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
          <p className="mt-2 text-gray-600">Track and manage your orders</p>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { key: 'all', label: 'All Orders', count: orders.length },
                { key: 'pending', label: 'Pending', count: orders.filter(o => o.status === 'PENDING' || o.status === 'CONFIRMED').length },
                { key: 'processing', label: 'Processing', count: orders.filter(o => o.status === 'PROCESSING' || o.status === 'SHIPPED').length },
                { key: 'completed', label: 'Completed', count: orders.filter(o => o.status === 'DELIVERED').length },
                { key: 'cancelled', label: 'Cancelled', count: orders.filter(o => o.status === 'CANCELLED').length },
                { key: 'payment-failed', label: 'Payment Failed', count: orders.filter(o => o.paymentStatus === 'FAILED').length },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`${
                    filter === tab.key
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                      filter === tab.key ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-900'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <TruckIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No orders found</h3>
            <p className="mt-2 text-gray-500">
              {filter === 'all' ? "You haven't placed any orders yet." : `No ${filter} orders found.`}
            </p>
            <div className="mt-6">
              <Link
                href="/products"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
              >
                Start Shopping
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6">
                  {/* Order Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Order #{order.orderNumber}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Placed on {formatDate(order.createdAt)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <div className={`inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium border ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                        <span className="ml-1">{order.status}</span>
                      </div>
                      
                      <Link
                        href={`/orders/${order.id}`}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <EyeIcon className="h-4 w-4 mr-1" />
                        View Details
                      </Link>
                    </div>
                  </div>

                  {/* Order Info */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-500">Total Amount</p>
                      <p className="font-semibold text-gray-900">₹{order.totalAmount.toFixed(2)}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-500">Payment Method</p>
                      <p className="font-medium text-gray-900">
                        {order.paymentMethod === 'card' && 'Card'}
                        {order.paymentMethod === 'upi' && 'UPI'}
                        {order.paymentMethod === 'cod' && 'Cash on Delivery'}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-500">Payment Status</p>
                      <div className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${getPaymentStatusColor(order.paymentStatus)}`}>
                        {getPaymentStatusIcon(order.paymentStatus)}
                        <span className="ml-1">{order.paymentStatus}</span>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-500">Items</p>
                      <p className="font-medium text-gray-900">
                        {order.orderItems.reduce((total, item) => total + item.quantity, 0)} item(s)
                      </p>
                    </div>
                  </div>

                  {/* Order Items Preview */}
                  <div className="border-t pt-4">
                    <div className="space-y-3">
                      {order.orderItems.slice(0, 2).map((item) => (
                        <div key={item.id} className="flex justify-between items-center">
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-gray-900">{item.name}</h4>
                            <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                          </div>
                          <p className="text-sm font-medium text-gray-900">
                            ₹{(item.price * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      ))}
                      
                      {order.orderItems.length > 2 && (
                        <div className="text-sm text-gray-500">
                          +{order.orderItems.length - 2} more item(s)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Delivery Address */}
                  <div className="border-t mt-4 pt-4">
                    <p className="text-sm text-gray-500 mb-1">Delivery Address</p>
                    <p className="text-sm text-gray-900">
                      {order.address.name}, {order.address.street}, {order.address.city}, {order.address.state} - {order.address.pincode}
                    </p>
                  </div>

                  {/* Special Messages for Failed Payments */}
                  {order.paymentStatus === 'FAILED' && (
                    <div className="border-t mt-4 pt-4">
                      <div className="bg-red-50 border border-red-200 rounded-md p-3">
                        <div className="flex">
                          <XCircleIcon className="h-5 w-5 text-red-400" />
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800">Payment Failed</h3>
                            <p className="mt-1 text-sm text-red-700">
                              Your payment could not be processed. Please try placing the order again.
                            </p>
                            <div className="mt-3">
                              <Link
                                href="/cart"
                                className="text-sm font-medium text-red-800 hover:text-red-900"
                              >
                                Retry Payment →
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
