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
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  UserIcon,
  BanknotesIcon,
  ShoppingBagIcon,
  ChartBarIcon,
  InboxArrowDownIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface Order {
  id: string
  orderNumber: string
  totalAmount: number
  subtotalAmount: number
  taxAmount: number
  shippingFee: number
  paymentMethod: string
  paymentStatus: string
  status: string
  notes: string | null
  createdAt: string
  updatedAt: string
  user: {
    id: string
    name: string | null
    email: string
  }
  address: {
    name: string
    street: string
    city: string
    state: string
    postalCode: string
  }
  orderItems: Array<{
    id: string
    name: string
    quantity: number
    price: number
    product: {
      id: string
      name: string
    }
  }>
  paymentLogs: Array<{
    id: string
    status: string
    method: string | null
    razorpayOrderId: string | null
    razorpayPaymentId: string | null
    failureReason: string | null
    createdAt: string
  }>
}

interface FilterState {
  status: string
  paymentStatus: string
  paymentMethod: string
  dateFrom: string
  dateTo: string
  search: string
}

export default function AdminOrdersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    paymentStatus: 'all',
    paymentMethod: 'all',
    dateFrom: '',
    dateTo: '',
    search: ''
  })

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    confirmed: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    totalRevenue: 0,
    avgOrderValue: 0
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPER_ADMIN') {
      router.push('/dashboard')
      return
    }

    fetchOrders()
  }, [status, session, router])

  useEffect(() => {
    applyFilters()
  }, [orders, filters])

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/admin/orders')
      
      if (response.ok) {
        const ordersData = await response.json()
        setOrders(ordersData)
        calculateStats(ordersData)
      } else {
        toast.error('Failed to fetch orders')
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
      toast.error('System error while loading orders')
    } finally {
      setIsLoading(false)
    }
  }

  const calculateStats = (ordersData: Order[]) => {
    const stats = {
      total: ordersData.length,
      pending: ordersData.filter(o => o.status === 'PENDING').length,
      confirmed: ordersData.filter(o => o.status === 'CONFIRMED').length,
      shipped: ordersData.filter(o => o.status === 'SHIPPED').length,
      delivered: ordersData.filter(o => o.status === 'DELIVERED').length,
      cancelled: ordersData.filter(o => o.status === 'CANCELLED').length,
      totalRevenue: ordersData
        .filter(o => o.paymentStatus === 'PAID')
        .reduce((sum, o) => sum + o.totalAmount, 0),
      avgOrderValue: 0
    }
    
    if (stats.total > 0) {
      stats.avgOrderValue = stats.totalRevenue / stats.total
    }

    setStats(stats)
  }

  const applyFilters = () => {
    let filtered = [...orders]

    // Search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase()
      filtered = filtered.filter(order => 
        order.orderNumber.toLowerCase().includes(searchTerm) ||
        order.user.name?.toLowerCase().includes(searchTerm) ||
        order.user.email.toLowerCase().includes(searchTerm) ||
        order.address.city.toLowerCase().includes(searchTerm)
      )
    }

    // Status filters
    if (filters.status !== 'all') {
      filtered = filtered.filter(order => order.status === filters.status)
    }

    if (filters.paymentStatus !== 'all') {
      filtered = filtered.filter(order => order.paymentStatus === filters.paymentStatus)
    }

    if (filters.paymentMethod !== 'all') {
      filtered = filtered.filter(order => order.paymentMethod === filters.paymentMethod)
    }

    // Date range filter
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom)
      filtered = filtered.filter(order => new Date(order.createdAt) >= fromDate)
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo)
      toDate.setHours(23, 59, 59, 999)
      filtered = filtered.filter(order => new Date(order.createdAt) <= toDate)
    }

    setFilteredOrders(filtered)
  }

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        setOrders(orders.map(order => 
          order.id === orderId 
            ? { ...order, status: newStatus, updatedAt: new Date().toISOString() }
            : order
        ))
        toast.success('Order status updated')
      } else {
        toast.error('Failed to update status')
      }
    } catch (error) {
      toast.error('Error updating order')
    }
  }

  const bulkUpdateStatus = async (status: string) => {
    if (selectedOrders.length === 0) return

    try {
      const response = await fetch('/api/admin/orders/bulk-update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: selectedOrders, status }),
      })

      if (response.ok) {
        toast.success(`Successfully updated ${selectedOrders.length} orders`)
        fetchOrders() 
        setSelectedOrders([]) 
      } else {
        toast.error('Bulk update failed')
      }
    } catch (error) {
      toast.error('Error processing bulk update')
    }
  }

  const exportOrders = () => {
    const csvData = filteredOrders.map(order => ({
      'Order Number': order.orderNumber,
      'Customer Name': order.user.name || 'N/A',
      'Customer Email': order.user.email,
      'Order Status': order.status,
      'Payment Status': order.paymentStatus,
      'Payment Method': order.paymentMethod?.toUpperCase(),
      'Total Amount': order.totalAmount,
      'Items Count': order.orderItems.length,
      'Order Date': new Date(order.createdAt).toLocaleString('en-IN'),
      'City': order.address.city,
      'State': order.address.state
    }))

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).map(v => `"${v}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orders-export-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    toast.success('Export downloaded successfully')
  }

  // Modern UI Helpers
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <ClockIcon className="h-4 w-4" />
      case 'CONFIRMED': return <CheckCircleIcon className="h-4 w-4" />
      case 'PROCESSING': return <InboxArrowDownIcon className="h-4 w-4" />
      case 'SHIPPED': return <TruckIcon className="h-4 w-4" />
      case 'DELIVERED': return <CheckCircleIcon className="h-4 w-4" />
      case 'CANCELLED': return <XCircleIcon className="h-4 w-4" />
      default: return <ClockIcon className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'text-amber-700 bg-amber-50 border-amber-200'
      case 'CONFIRMED': return 'text-blue-700 bg-blue-50 border-blue-200'
      case 'PROCESSING': return 'text-indigo-700 bg-indigo-50 border-indigo-200'
      case 'SHIPPED': return 'text-purple-700 bg-purple-50 border-purple-200'
      case 'DELIVERED': return 'text-emerald-700 bg-emerald-50 border-emerald-200'
      case 'CANCELLED': return 'text-rose-700 bg-rose-50 border-rose-200'
      default: return 'text-gray-700 bg-gray-50 border-gray-200'
    }
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return 'text-emerald-700 bg-emerald-50 border border-emerald-200'
      case 'PENDING': return 'text-amber-700 bg-amber-50 border border-amber-200'
      case 'FAILED': return 'text-rose-700 bg-rose-50 border border-rose-200'
      case 'REFUNDED': return 'text-gray-700 bg-gray-100 border border-gray-300'
      default: return 'text-gray-600 bg-gray-50 border border-gray-200'
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <div className="sm:flex sm:items-end sm:justify-between mb-8">
          <div>
            <Link 
              href="/admin" 
              className="inline-flex items-center text-sm font-bold text-gray-500 hover:text-gray-900 mb-3 transition group"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1 group-hover:-translate-x-1 transition-transform" />
              Back to Command Center
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Order Management</h1>
            <p className="mt-1 text-sm text-gray-500">Track, fulfill, and manage customer orders across your store.</p>
          </div>
          
          <div className="mt-4 sm:mt-0 flex space-x-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-semibold transition ${
                showFilters ? 'bg-gray-100 border-gray-300 text-gray-900' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FunnelIcon className="h-4 w-4 mr-2" />
              Advanced Filters
            </button>
            
            <button
              onClick={exportOrders}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 transition"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <BanknotesIcon className="h-8 w-8" />
            </div>
            <div className="ml-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Gross Revenue</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">
                ₹{stats.totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <ShoppingBagIcon className="h-8 w-8" />
            </div>
            <div className="ml-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Order Volume</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{stats.total.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
              <ClockIcon className="h-8 w-8" />
            </div>
            <div className="ml-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Awaiting Processing</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{stats.pending.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
              <ChartBarIcon className="h-8 w-8" />
            </div>
            <div className="ml-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Average Order Value</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">
                ₹{stats.avgOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Expandable Filters Section */}
        {showFilters && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6 animate-in slide-in-from-top-4 fade-in duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-5">
              <div className="lg:col-span-2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Search Orders</label>
                <div className="relative">
                  <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Order ID, Customer Name, Email, City..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-red-500 focus:border-red-500 shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Fulfillment</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm focus:ring-red-500 focus:border-red-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="SHIPPED">Shipped</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Payment</label>
                <select
                  value={filters.paymentStatus}
                  onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm focus:ring-red-500 focus:border-red-500"
                >
                  <option value="all">All Payments</option>
                  <option value="PENDING">Pending</option>
                  <option value="PAID">Paid</option>
                  <option value="FAILED">Failed</option>
                  <option value="REFUNDED">Refunded</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Start Date</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">End Date</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>
            
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setFilters({
                  status: 'all', paymentStatus: 'all', paymentMethod: 'all',
                  dateFrom: '', dateTo: '', search: ''
                })}
                className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-50 border border-gray-300 rounded-md hover:bg-gray-100 transition"
              >
                Reset Filters
              </button>
            </div>
          </div>
        )}

        {/* Bulk Action Toolbar */}
        {selectedOrders.length > 0 && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-xl shadow-sm mb-6 flex items-center justify-between animate-in slide-in-from-bottom-4 duration-200">
            <span className="text-sm font-bold text-red-900">
              {selectedOrders.length} order(s) selected
            </span>
            <div className="flex space-x-3">
              <button onClick={() => bulkUpdateStatus('CONFIRMED')} className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-blue-700 bg-white border border-blue-200 rounded-md hover:bg-blue-50 shadow-sm">
                Mark Confirmed
              </button>
              <button onClick={() => bulkUpdateStatus('SHIPPED')} className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-purple-700 bg-white border border-purple-200 rounded-md hover:bg-purple-50 shadow-sm">
                Mark Shipped
              </button>
              <button onClick={() => bulkUpdateStatus('DELIVERED')} className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 bg-white border border-emerald-200 rounded-md hover:bg-emerald-50 shadow-sm">
                Mark Delivered
              </button>
            </div>
          </div>
        )}

        {/* Main Orders Table */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-12">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedOrders(filteredOrders.map(o => o.id))
                        } else {
                          setSelectedOrders([])
                        }
                      }}
                      checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                      className="rounded border-gray-300 text-red-600 shadow-sm focus:ring-red-500"
                    />
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Order Details
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Customer Info
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Fulfillment Status
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Payment Status
                  </th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Total Amount
                  </th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedOrders.includes(order.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedOrders([...selectedOrders, order.id])
                          } else {
                            setSelectedOrders(selectedOrders.filter(id => id !== order.id))
                          }
                        }}
                        className="rounded border-gray-300 text-red-600 shadow-sm focus:ring-red-500"
                      />
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-bold text-gray-900">
                          #{order.orderNumber}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {order.orderItems.length} item(s)
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 text-gray-500">
                          <UserIcon className="h-4 w-4" />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-bold text-gray-900">
                            {order.user.name || 'N/A'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {order.user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusColor(order.status)}`}>
                          {getStatusIcon(order.status)}
                          <span className="ml-1.5">{order.status}</span>
                        </div>
                        
                        {/* Quick Status Update Dropdown */}
                        <select
                          value={order.status}
                          onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                          className="text-xs font-semibold border-gray-300 text-gray-600 rounded-md focus:ring-red-500 focus:border-red-500 shadow-sm py-1 pl-2 pr-6"
                        >
                          <option value="PENDING">Pending</option>
                          <option value="CONFIRMED">Confirmed</option>
                          <option value="PROCESSING">Processing</option>
                          <option value="SHIPPED">Shipped</option>
                          <option value="DELIVERED">Delivered</option>
                          <option value="CANCELLED">Cancelled</option>
                        </select>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col space-y-1 items-start">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getPaymentStatusColor(order.paymentStatus)}`}>
                          {order.paymentStatus}
                        </span>
                        <span className="text-xs text-gray-500 font-medium">
                          {order.paymentMethod === 'card' && 'Credit/Debit Card'}
                          {order.paymentMethod === 'upi' && 'UPI Transfer'}
                          {order.paymentMethod === 'cod' && 'Cash on Delivery'}
                          {!['card', 'upi', 'cod'].includes(order.paymentMethod) && order.paymentMethod?.toUpperCase()}
                        </span>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-bold text-gray-900">
                        ₹{order.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      {order.taxAmount > 0 && (
                        <div className="text-[10px] text-gray-500 uppercase tracking-wide mt-1">
                          Includes Tax
                        </div>
                      )}
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-3">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="text-gray-400 hover:text-red-600 transition"
                          title="View Order Details"
                        >
                          <EyeIcon className="h-5 w-5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Empty State */}
          {filteredOrders.length === 0 && !isLoading && (
            <div className="text-center py-16 bg-gray-50">
              <InboxArrowDownIcon className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-4 text-sm font-bold text-gray-900">No Orders Found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {filters.search || filters.status !== 'all' || filters.paymentStatus !== 'all' 
                  ? 'We couldn\'t find any orders matching your current filters.'
                  : 'Orders will appear here once customers complete the checkout process.'}
              </p>
              {(filters.search || filters.status !== 'all' || filters.paymentStatus !== 'all') && (
                <button
                  onClick={() => setFilters({ status: 'all', paymentStatus: 'all', paymentMethod: 'all', dateFrom: '', dateTo: '', search: '' })}
                  className="mt-4 text-sm font-bold text-red-600 hover:text-red-800"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}