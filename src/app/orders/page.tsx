'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  EyeIcon, 
  TruckIcon, 
  CheckCircleIcon, 
  ClockIcon, 
  XCircleIcon,
  ExclamationTriangleIcon,
  ShoppingBagIcon,
  CreditCardIcon,
  MapPinIcon,
  CubeIcon,
  BanknotesIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline'

interface OrderItem {
  id: string
  name: string
  quantity: number
  unitPrice: number | string
  totalPrice: number | string
}

interface Address {
  name: string
  street1: string
  street2?: string
  city: string
  state: string
  postalCode: string
}

interface Order {
  id: string
  orderNumber: string
  totalAmount: number | string
  paymentMethod: string
  paymentStatus: string
  status: string
  createdAt: string
  updatedAt: string
  orderItems: OrderItem[]
  address: Address
}

type FilterKey =
  | 'all'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'payment-failed'

const ORDER_FILTERS: {
  key: FilterKey
  label: string
  match: (order: Order) => boolean
}[] = [
  { key: 'all', label: 'All Orders', match: () => true },
  { key: 'paid', label: 'Paid', match: (o) => o.paymentStatus === 'PAID' },
  {
    key: 'processing',
    label: 'Processing',
    match: (o) => ['PENDING', 'CONFIRMED', 'PROCESSING'].includes(o.status),
  },
  { key: 'shipped', label: 'Shipped', match: (o) => o.status === 'SHIPPED' },
  { key: 'delivered', label: 'Delivered', match: (o) => o.status === 'DELIVERED' },
  {
    key: 'cancelled',
    label: 'Cancelled',
    match: (o) => o.status === 'CANCELLED' || o.status === 'REFUNDED',
  },
  {
    key: 'payment-failed',
    label: 'Payment Failed',
    match: (o) => o.paymentStatus === 'FAILED',
  },
]

const ITEMS_PER_PAGE = 5 // 👈 Number of orders shown per page

export default function OrdersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    let isMounted = true
    
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/orders')
      return
    }

    const fetchOrders = async () => {
      if (!isMounted || status !== 'authenticated') return
      
      try {
        const response = await fetch('/api/orders')
        
        if (!isMounted) return
        
        if (response.ok) {
          const ordersData = await response.json()
          if (isMounted) {
            setOrders(ordersData)
          }
        } else {
          console.error('Failed to fetch orders')
        }
      } catch (error) {
        console.error('Error fetching orders:', error)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    if (status === 'authenticated') {
      fetchOrders()
    }

    return () => {
      isMounted = false
    }
  }, [status, router])

  // Reset to page 1 whenever the filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filter])

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
      case 'REFUNDED':
        return <BanknotesIcon className="h-5 w-5 text-orange-600" />
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
      case 'REFUNDED':
        return 'text-orange-700 bg-orange-50 border-orange-200'
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
        return 'text-green-700 bg-green-50 ring-1 ring-green-200'
      case 'AUTHORIZED':
        return 'text-blue-700 bg-blue-50 ring-1 ring-blue-200'
      case 'PENDING':
        return 'text-yellow-700 bg-yellow-50 ring-1 ring-yellow-200'
      case 'FAILED':
        return 'text-red-700 bg-red-50 ring-1 ring-red-200'
      case 'REFUNDED':
      case 'PARTIALLY_REFUNDED':
        return 'text-orange-700 bg-orange-50 ring-1 ring-orange-200'
      default:
        return 'text-gray-700 bg-gray-50 ring-1 ring-gray-200'
    }
  }

  const activeFilter = ORDER_FILTERS.find((f) => f.key === filter) ?? ORDER_FILTERS[0]
  const filteredOrders = orders.filter(activeFilter.match)

  // Pagination Calculations
  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedOrders = filteredOrders.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  const paidCount = orders.filter((o) => o.paymentStatus === 'PAID').length
  const inTransitCount = orders.filter((o) =>
    ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'].includes(o.status)
  ).length
  const totalSpent = orders
    .filter((o) => o.paymentStatus === 'PAID')
    .reduce((sum, o) => sum + Number(o.totalAmount), 0)

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
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="mt-3 h-4 w-72 bg-gray-200 rounded animate-pulse" />
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 bg-white rounded-2xl border border-gray-200 animate-pulse" />
            ))}
          </div>
          <div className="mt-8 space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-48 bg-white rounded-2xl border border-gray-200 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">My Orders</h1>
            <p className="mt-2 text-gray-600">Track and manage your orders</p>
          </div>
          <Link
            href="/products"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 shadow-sm transition-colors"
          >
            <ShoppingBagIcon className="h-5 w-5 mr-2" />
            Continue Shopping
          </Link>
        </div>

        {/* Summary */}
        {orders.length > 0 && (
          <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-600">
                <CheckCircleIcon className="h-6 w-6" />
              </span>
              <div>
                <p className="text-sm text-gray-500">Paid Orders</p>
                <p className="text-2xl font-bold text-gray-900">{paidCount}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <TruckIcon className="h-6 w-6" />
              </span>
              <div>
                <p className="text-sm text-gray-500">In Progress</p>
                <p className="text-2xl font-bold text-gray-900">{inTransitCount}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <BanknotesIcon className="h-6 w-6" />
              </span>
              <div>
                <p className="text-sm text-gray-500">Total Spent</p>
                <p className="text-2xl font-bold text-gray-900">Rs {totalSpent.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {ORDER_FILTERS.map((tab) => {
            const count = orders.filter(tab.match).length
            const isActive = filter === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                aria-pressed={isActive}
                className={`${
                  isActive
                    ? 'bg-green-600 text-white border-green-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-green-300 hover:text-green-700'
                } whitespace-nowrap inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors`}
              >
                {tab.label}
                <span
                  className={`${
                    isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                  } rounded-full px-2 py-0.5 text-xs font-semibold`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">
              <ShoppingBagIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">No orders found</h3>
            <p className="mt-2 text-gray-500">
              {filter === 'all'
                ? "You haven't placed any orders yet."
                : `No orders in "${activeFilter.label}" right now.`}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {filter !== 'all' && (
                <button
                  onClick={() => setFilter('all')}
                  className="inline-flex items-center px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  View all orders
                </button>
              )}
              <Link
                href="/products"
                className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 shadow-sm"
              >
                Start Shopping
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {paginatedOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-shadow hover:shadow-md"
              >
                {/* Order Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/60 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-gray-200">
                      {getStatusIcon(order.status)}
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">
                        Order #{order.orderNumber}
                      </h3>
                      <p className="text-sm text-gray-500">Placed on {formatDate(order.createdAt)}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${getStatusColor(order.status)}`}
                    >
                      {order.status}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${getPaymentStatusColor(order.paymentStatus)}`}
                    >
                      {getPaymentStatusIcon(order.paymentStatus)}
                      {order.paymentStatus}
                    </span>
                    <Link
                      href={`/orders/${order.id}`}
                      className="inline-flex items-center rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <EyeIcon className="h-4 w-4 mr-1" />
                      View Details
                    </Link>
                  </div>
                </div>

                <div className="p-6">
                  {/* Order Info */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5">
                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Total Amount</p>
                      <p className="mt-1 text-lg font-bold text-gray-900">
                        Rs {Number(order.totalAmount).toFixed(2)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Payment Method</p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-gray-900 uppercase">
                        <CreditCardIcon className="h-4 w-4 text-gray-400" />
                        {order.paymentMethod}
                      </p>
                    </div>

                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Items</p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                        <CubeIcon className="h-4 w-4 text-gray-400" />
                        {order.orderItems.reduce((total, item) => total + item.quantity, 0)} item(s)
                      </p>
                    </div>
                  </div>

                  {/* Order Items Preview */}
                  <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                    {order.orderItems.slice(0, 2).map((item) => (
                      <div key={item.id} className="flex items-center justify-between px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="truncate text-sm font-medium text-gray-900">{item.name}</h4>
                          <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                        </div>
                        <p className="ml-4 text-sm font-semibold text-gray-900">
                          Rs {Number(item.totalPrice).toFixed(2)}
                        </p>
                      </div>
                    ))}

                    {order.orderItems.length > 2 && (
                      <Link
                        href={`/orders/${order.id}`}
                        className="block px-4 py-2.5 text-sm font-medium text-green-700 hover:bg-green-50"
                      >
                        +{order.orderItems.length - 2} more item(s)
                      </Link>
                    )}
                  </div>

                  {/* Delivery Address */}
                  {order.address && (
                    <div className="mt-4 flex items-start gap-2">
                      <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">Delivery Address</p>
                        <p className="text-sm text-gray-900">
                          {order.address.name}, {order.address.street1}
                          {order.address.street2 ? `, ${order.address.street2}` : ''}, {order.address.city}, {order.address.state} - {order.address.postalCode}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Special Messages for Failed Payments */}
                  {order.paymentStatus === 'FAILED' && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                      <div className="flex">
                        <XCircleIcon className="h-5 w-5 shrink-0 text-red-400" />
                        <div className="ml-3">
                          <h3 className="text-sm font-semibold text-red-800">Payment Failed</h3>
                          <p className="mt-1 text-sm text-red-700">
                            Your payment could not be processed. Please try placing the order again.
                          </p>
                          <div className="mt-3 space-x-4">
                            <Link
                              href={`/orders/${order.id}?action=retry`}
                              className="inline-block text-sm font-medium text-red-800 hover:text-red-900 underline"
                            >
                              View Details &amp; Retry →
                            </Link>
                            <Link
                              href="/cart"
                              className="inline-block text-sm font-medium text-gray-600 hover:text-gray-800 underline"
                            >
                              Start New Order
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 rounded-2xl shadow-sm">
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                      <span className="font-medium">
                        {Math.min(startIndex + ITEMS_PER_PAGE, filteredOrders.length)}
                      </span>{' '}
                      of <span className="font-medium">{filteredOrders.length}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                      <button
                        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Previous</span>
                        <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          aria-current={currentPage === page ? 'page' : undefined}
                          className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 ${
                            currentPage === page
                              ? 'z-10 bg-green-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600'
                              : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-offset-0'
                          }`}
                        >
                          {page}
                        </button>
                      ))}

                      <button
                        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Next</span>
                        <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </nav>
                  </div>
                </div>

                {/* Mobile Pagination View */}
                <div className="flex items-center justify-between sm:hidden w-full">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <p className="text-sm text-gray-700">
                    Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
                  </p>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}