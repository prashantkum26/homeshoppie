'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import toast from 'react-hot-toast'

interface User {
  id: string
  name: string | null
  email: string
  role: string
  createdAt: string
}

interface Product {
  id: string
  name: string
  price: number
  stock: number
  isActive: boolean
  category: {
    name: string
  }
}

interface Order {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  createdAt: string
  user: {
    name: string | null
    email: string
  }
}

interface DashboardStats {
  totalUsers: number
  totalProducts: number
  totalOrders: number
  totalRevenue: number
  recentOrders: Order[]
  lowStockProducts: Product[]
}

export default function AdminDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('overview')
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    const fetchAdminData = async () => {
      if (!isMounted || status !== 'authenticated' || session?.user?.role !== 'ADMIN') return
      
      try {
        // Fetch all admin data concurrently to reduce total API calls
        const [statsRes, usersRes, productsRes, ordersRes] = await Promise.all([
          fetch('/api/admin/stats'),
          fetch('/api/admin/users'),
          fetch('/api/admin/products'),
          fetch('/api/admin/orders')
        ])
        
        if (!isMounted) return // Check if component is still mounted
        
        if (statsRes.ok) {
          const statsData = await statsRes.json()
          if (isMounted) setStats(statsData)
        }

        if (usersRes.ok) {
          const usersData = await usersRes.json()
          if (isMounted) setUsers(usersData)
        }

        if (productsRes.ok) {
          const productsData = await productsRes.json()
          if (isMounted) setProducts(productsData)
        }

        if (ordersRes.ok) {
          const ordersData = await ordersRes.json()
          if (isMounted) setOrders(ordersData)
        }
      } catch (error) {
        console.error('Error fetching admin data:', error)
        if (isMounted) {
          toast.error('Failed to load admin data')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    if (status === 'authenticated') {
      if (session?.user?.role !== 'ADMIN') {
        router.push('/dashboard')
        toast.error('Access denied. Admin privileges required.')
        return
      }
      
      fetchAdminData()
    }

    return () => {
      isMounted = false
    }
  }, [status, session?.user?.role, router]) // Only depend on essential values

  const fetchAdminData = async () => {
    // This function is now defined inside useEffect to prevent re-renders
    // Keep it here for other functions that might need to refresh data
    try {
      setIsLoading(true)
      
      const [statsRes, usersRes, productsRes, ordersRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/users'),
        fetch('/api/admin/products'),
        fetch('/api/admin/orders')
      ])
      
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json()
        setUsers(usersData)
      }

      if (productsRes.ok) {
        const productsData = await productsRes.json()
        setProducts(productsData)
      }

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json()
        setOrders(ordersData)
      }
    } catch (error) {
      console.error('Error fetching admin data:', error)
      toast.error('Failed to load admin data')
    } finally {
      setIsLoading(false)
    }
  }

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error('Failed to update order status')
      }

      // Refresh orders data
      fetchAdminData()
      toast.success('Order status updated successfully')
    } catch (error) {
      toast.error('Failed to update order status')
    }
  }

  const toggleProductStatus = async (productId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: !isActive }),
      })

      if (!response.ok) {
        throw new Error('Failed to update product status')
      }

      // Refresh products data
      fetchAdminData()
      toast.success('Product status updated successfully')
    } catch (error) {
      toast.error('Failed to update product status')
    }
  }

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      })

      if (!response.ok) {
        throw new Error('Failed to update user role')
      }

      // Refresh users data
      fetchAdminData()
      toast.success('User role updated successfully')
    } catch (error) {
      toast.error('Failed to update user role')
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-red-600"></div>
      </div>
    )
  }

  if (!session || session.user.role !== 'ADMIN') {
    return null
  }

  const getStatusColor = (status: string) => {
    const colors = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      CONFIRMED: 'bg-blue-100 text-blue-800',
      PROCESSING: 'bg-purple-100 text-purple-800',
      SHIPPED: 'bg-indigo-100 text-indigo-800',
      DELIVERED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
    }
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          {/* Header */}
          <div className="bg-red-600 text-white px-4 py-5 border-b border-red-700 sm:px-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                <p className="mt-1 text-red-100">
                  Welcome, {session.user.name || 'Admin'}!
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center px-4 py-2 border border-red-400 text-sm font-medium rounded-md text-red-100 hover:bg-red-500"
                >
                  User Dashboard
                </Link>
                <Link
                  href="/products"
                  className="inline-flex items-center px-4 py-2 border border-red-400 text-sm font-medium rounded-md text-red-100 hover:bg-red-500"
                >
                  View Store
                </Link>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {[
                { id: 'overview', name: 'Overview' },
                { id: 'orders', name: 'Orders' },
                { id: 'products', name: 'Products' },
                { id: 'users', name: 'Users' },
                { id: 'analytics', name: 'Analytics' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-red-500 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'overview' && stats && (
              <div className="space-y-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-blue-50 p-6 rounded-lg">
                    <h3 className="text-lg font-medium text-blue-900">Total Users</h3>
                    <p className="text-3xl font-bold text-blue-600">{stats.totalUsers}</p>
                  </div>
                  <div className="bg-green-50 p-6 rounded-lg">
                    <h3 className="text-lg font-medium text-green-900">Total Products</h3>
                    <p className="text-3xl font-bold text-green-600">{stats.totalProducts}</p>
                  </div>
                  <div className="bg-purple-50 p-6 rounded-lg">
                    <h3 className="text-lg font-medium text-purple-900">Total Orders</h3>
                    <p className="text-3xl font-bold text-purple-600">{stats.totalOrders}</p>
                  </div>
                  <div className="bg-yellow-50 p-6 rounded-lg">
                    <h3 className="text-lg font-medium text-yellow-900">Total Revenue</h3>
                    <p className="text-3xl font-bold text-yellow-600">₹{stats.totalRevenue.toFixed(2)}</p>
                  </div>
                </div>

                {/* Recent Orders */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Orders</h3>
                  <div className="bg-white shadow overflow-hidden sm:rounded-md">
                    <ul className="divide-y divide-gray-200">
                      {stats.recentOrders.slice(0, 5).map((order) => (
                        <li key={order.id} className="px-6 py-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900">#{order.orderNumber}</p>
                              <p className="text-sm text-gray-500">{order.user.email}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-900">₹{order.totalAmount.toFixed(2)}</p>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                {order.status}
                              </span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Low Stock Products */}
                {stats.lowStockProducts.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Low Stock Alert</h3>
                    <div className="bg-red-50 border border-red-200 rounded-md p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h4 className="text-sm font-medium text-red-800">Products running low on stock:</h4>
                          <ul className="mt-2 text-sm text-red-700">
                            {stats.lowStockProducts.map((product) => (
                              <li key={product.id}>
                                {product.name} - {product.stock} remaining
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-gray-900">Order Management</h2>
                  <div className="text-sm text-gray-500">
                    Total Orders: {orders.length}
                  </div>
                </div>

                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                  <ul className="divide-y divide-gray-200">
                    {orders.map((order) => (
                      <li key={order.id} className="px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-gray-900">#{order.orderNumber}</p>
                              <p className="text-sm text-gray-500">
                                {new Date(order.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <p className="text-sm text-gray-500">Customer: {order.user.email}</p>
                            <p className="text-sm text-gray-900">Amount: ₹{order.totalAmount.toFixed(2)}</p>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <select
                              value={order.status}
                              onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                              className="text-sm border border-gray-300 rounded px-2 py-1"
                            >
                              <option value="PENDING">Pending</option>
                              <option value="CONFIRMED">Confirmed</option>
                              <option value="PROCESSING">Processing</option>
                              <option value="SHIPPED">Shipped</option>
                              <option value="DELIVERED">Delivered</option>
                              <option value="CANCELLED">Cancelled</option>
                            </select>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {activeTab === 'products' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-gray-900">Product Management</h2>
                  <Link
                    href="/admin/products/new"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                  >
                    Add New Product
                  </Link>
                </div>

                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                  <ul className="divide-y divide-gray-200">
                    {products.map((product) => (
                      <li key={product.id} className="px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{product.name}</p>
                            <p className="text-sm text-gray-500">Category: {product.category.name}</p>
                            <p className="text-sm text-gray-500">Price: ₹{product.price} | Stock: {product.stock}</p>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              product.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {product.isActive ? 'Active' : 'Inactive'}
                            </span>
                            
                            <button
                              onClick={() => toggleProductStatus(product.id, product.isActive)}
                              className="text-sm text-blue-600 hover:text-blue-500"
                            >
                              {product.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            
                            <Link
                              href={`/admin/products/${product.id}/edit`}
                              className="text-sm text-gray-600 hover:text-gray-500"
                            >
                              Edit
                            </Link>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-gray-900">User Management</h2>
                  <div className="text-sm text-gray-500">
                    Total Users: {users.length}
                  </div>
                </div>

                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                  <ul className="divide-y divide-gray-200">
                    {users.map((user) => (
                      <li key={user.id} className="px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{user.name || 'No name'}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                            <p className="text-sm text-gray-500">
                              Joined: {new Date(user.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <select
                              value={user.role}
                              onChange={(e) => updateUserRole(user.id, e.target.value)}
                              className="text-sm border border-gray-300 rounded px-2 py-1"
                              disabled={user.id === session.user.id}
                            >
                              <option value="USER">User</option>
                              <option value="ADMIN">Admin</option>
                            </select>
                            
                            {user.id === session.user.id && (
                              <span className="text-xs text-gray-500">(You)</span>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {activeTab === 'analytics' && stats && (
              <div className="space-y-8">
                <h2 className="text-lg font-medium text-gray-900">Analytics Overview</h2>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-lg border">
                    <h3 className="text-md font-medium text-gray-900 mb-4">Revenue Summary</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Total Revenue:</span>
                        <span className="text-sm font-medium">₹{stats.totalRevenue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Average Order Value:</span>
                        <span className="text-sm font-medium">
                          ₹{stats.totalOrders > 0 ? (stats.totalRevenue / stats.totalOrders).toFixed(2) : '0.00'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-6 rounded-lg border">
                    <h3 className="text-md font-medium text-gray-900 mb-4">Inventory Summary</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Total Products:</span>
                        <span className="text-sm font-medium">{stats.totalProducts}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Low Stock Items:</span>
                        <span className="text-sm font-medium text-red-600">{stats.lowStockProducts.length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
