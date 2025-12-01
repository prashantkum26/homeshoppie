'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  CheckCircleIcon, 
  ClockIcon, 
  TruckIcon, 
  XMarkIcon,
  EyeIcon,
  FunnelIcon
} from '@heroicons/react/24/outline'

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
}

const ORDER_STATUSES = [
  { key: 'ALL', label: 'All Orders', color: 'gray' },
  { key: 'PENDING', label: 'Pending', color: 'yellow' },
  { key: 'CONFIRMED', label: 'Confirmed', color: 'blue' },
  { key: 'PROCESSING', label: 'Processing', color: 'purple' },
  { key: 'SHIPPED', label: 'Shipped', color: 'indigo' },
  { key: 'DELIVERED', label: 'Delivered', color: 'green' },
  { key: 'CANCELLED', label: 'Cancelled', color: 'red' },
]

export default function EnhancedOrdersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (session?.user) {
      fetchOrders()
    }
  }, [session, status, router])

  useEffect(() => {
    filterOrders()
  }, [orders, activeTab, searchTerm])

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/orders')
      if (response.ok) {
        const data = await response.json()
        setOrders(data)
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterOrders = () => {
    let filtered = orders

    // Filter by status
    if (activeTab !== 'ALL') {
      filtered = filtered.filter(order => order.status === activeTab)
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(order => 
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.orderItems.some(item => 
          item.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    }

    setFilteredOrders(filtered)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'PROCESSING':
        return <ClockIcon className="h-5 w-5 text-blue-500" />
      case 'SHIPPED':
        return <TruckIcon className="h-5 w-5 text-purple-500" />
      case 'DELIVERED':
        return <CheckCircleIcon className="h-5 w-5 text-green-600" />
      case 'CANCELLED':
        return <XMarkIcon className="h-5 w-5 text-red-500" />
      default:
        return <ClockIcon className="h-5 w-5 text-yellow-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-green-50 text-green-700 border-green-200'
      case 'PROCESSING':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'SHIPPED':
        return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'DELIVERED':
        return 'bg-green-50 text-green-800 border-green-300'
      case 'CANCELLED':
        return 'bg-red-50 text-red-700 border-red-200'
      default:
        return 'bg-yellow-50 text-yellow-700 border-yellow-200'
    }
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'bg-green-100 text-green-800'
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'FAILED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getOrdersCountByStatus = (status: string) => {
    if (status === 'ALL') return orders.length
    return orders.filter(order => order.status === status).length
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600"></div>
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
          <p className="mt-2 text-gray-600">Track and manage your orders</p>
        </div>

        {/* Search and Filter Bar */}
        <div className="mb-6 bg-white rounded-lg shadow p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search orders by order number or product name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                />
                <FunnelIcon className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
              </div>
            </div>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 overflow-x-auto">
              {ORDER_STATUSES.map((statusItem) => (
                <button
                  key={statusItem.key}
                  onClick={() => setActiveTab(statusItem.key)}
                  className={`
                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
                    ${activeTab === statusItem.key
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  {statusItem.label}
                  <span className={`
                    inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${activeTab === statusItem.key 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                    }
                  `}>
                    {getOrdersCountByStatus(statusItem.key)}
                  </span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Orders List */}
        <div className="space-y-6">
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="max-w-md mx-auto">
                <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {activeTab === 'ALL' ? 'No orders yet' : `No ${activeTab.toLowerCase()} orders`}
                </h3>
                <p className="text-gray-500 mb-6">
                  {activeTab === 'ALL' 
                    ? "You haven't placed any orders yet. Start shopping to see your orders here."
                    : `You don't have any ${activeTab.toLowerCase()} orders at the moment.`
                  }
                </p>
                {activeTab === 'ALL' && (
                  <Link
                    href="/products"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                  >
                    Start Shopping
                  </Link>
                )}
              </div>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {/* Order Header */}
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Order Number</p>
                        <p className="font-semibold text-gray-900">{order.orderNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Date</p>
                        <p className="font-medium text-gray-900">
                          {new Date(order.createdAt).toLocaleDateString('en-IN')}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Total Amount</p>
                        <p className="font-semibold text-gray-900">₹{order.totalAmount.toFixed(2)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {/* Order Status */}
                      <div className={`
                        inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border
                        ${getStatusColor(order.status)}
                      `}>
                        {getStatusIcon(order.status)}
                        {order.status}
                      </div>
                      
                      {/* Payment Status */}
                      <span className={`
                        inline-flex px-2 py-1 text-xs font-medium rounded-full
                        ${getPaymentStatusColor(order.paymentStatus)}
                      `}>
                        {order.paymentStatus}
                      </span>
                      
                      {/* View Details Button */}
                      <Link
                        href={`/orders/${order.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium text-green-600 hover:text-green-700 hover:bg-green-50 rounded-md transition-colors"
                      >
                        <EyeIcon className="h-4 w-4" />
                        View Details
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div className="px-6 py-4">
                  <div className="space-y-3">
                    {order.orderItems.slice(0, 3).map((item, index) => (
                      <div key={item.id} className="flex justify-between items-center">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{item.name}</p>
                          <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          ₹{(item.price * item.quantity).toFixed(2)}
                        </div>
                      </div>
                    ))}
                    
                    {order.orderItems.length > 3 && (
                      <p className="text-sm text-gray-500 italic">
                        +{order.orderItems.length - 3} more items
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Payment Method:</span>
                      <span className="font-medium text-gray-900 capitalize">
                        {order.paymentMethod === 'card' && 'Credit/Debit Card'}
                        {order.paymentMethod === 'upi' && 'UPI Payment'}
                        {order.paymentMethod === 'cod' && 'Cash on Delivery'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Quick Actions */}
        {orders.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link
                href="/products"
                className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Continue Shopping
              </Link>
              <button
                onClick={() => setActiveTab('DELIVERED')}
                className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                View Delivered Orders
              </button>
              <Link
                href="/contact"
                className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Need Help?
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
