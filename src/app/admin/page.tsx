'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { 
  UsersIcon, 
  ChatBubbleLeftRightIcon, 
  FolderOpenIcon, 
  ArchiveBoxIcon,
  PhotoIcon, 
  TagIcon, 
  ClipboardDocumentListIcon,
  CreditCardIcon, 
  ScaleIcon, 
  ShieldCheckIcon,
  BanknotesIcon,
  ShoppingBagIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline'

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
      if (!isMounted || status !== 'authenticated' || (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPER_ADMIN')) return
      
      try {
        const [statsRes, usersRes, productsRes, ordersRes] = await Promise.all([
          fetch('/api/admin/stats'),
          fetch('/api/admin/users'),
          fetch('/api/admin/products'),
          fetch('/api/admin/orders')
        ])
        
        if (!isMounted) return
        
        if (statsRes.ok) setStats(await statsRes.json())
        if (usersRes.ok) setUsers(await usersRes.json())
        if (productsRes.ok) setProducts(await productsRes.json())
        if (ordersRes.ok) setOrders(await ordersRes.json())
      } catch (error) {
        console.error('Error fetching admin data:', error)
        if (isMounted) toast.error('Failed to load admin data')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    if (status === 'authenticated') {
      if (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPER_ADMIN') {
        router.push('/dashboard')
        toast.error('Access denied. Admin privileges required.')
        return
      }
      fetchAdminData()
    }

    return () => { isMounted = false }
  }, [status, session?.user?.role, router])

  const fetchAdminData = async () => {
    try {
      setIsLoading(true)
      const [statsRes, usersRes, productsRes, ordersRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/users'),
        fetch('/api/admin/products'),
        fetch('/api/admin/orders')
      ])
      
      if (statsRes.ok) setStats(await statsRes.json())
      if (usersRes.ok) setUsers(await usersRes.json())
      if (productsRes.ok) setProducts(await productsRes.json())
      if (ordersRes.ok) setOrders(await ordersRes.json())
    } catch (error) {
      toast.error('Failed to load admin data')
    } finally {
      setIsLoading(false)
    }
  }

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!response.ok) throw new Error('Failed to update order status')
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      })
      if (!response.ok) throw new Error('Failed to update product status')
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (!response.ok) throw new Error('Failed to update user role')
      fetchAdminData()
      toast.success('User role updated successfully')
    } catch (error) {
      toast.error('Failed to update user role')
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

  const getStatusColor = (status: string) => {
    const colors = {
      PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-200',
      PROCESSING: 'bg-purple-100 text-purple-800 border-purple-200',
      SHIPPED: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      DELIVERED: 'bg-green-100 text-green-800 border-green-200',
      CANCELLED: 'bg-red-100 text-red-800 border-red-200',
    }
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  // Refactored Module Card with Heroicons support
  const ModuleCard = ({ title, desc, link, icon: Icon, colorClass }: { title: string, desc: string, link: string, icon: any, colorClass: string }) => (
    <Link href={link} className="block p-5 bg-white border border-gray-200 rounded-xl hover:border-red-500 hover:shadow-lg transition-all group duration-200">
      <div className="flex items-start space-x-4 mb-3">
        <div className={`p-3 rounded-lg ${colorClass} group-hover:scale-110 transition-transform duration-200`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1 pt-1">
          <h4 className="text-base font-bold text-gray-900 group-hover:text-red-600 transition-colors">{title}</h4>
        </div>
      </div>
      <p className="text-sm text-gray-500 line-clamp-2">{desc}</p>
    </Link>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        {/* Header Section */}
        <div className="bg-gradient-to-r from-red-700 to-red-900 rounded-2xl shadow-lg overflow-hidden mb-8">
          <div className="px-8 py-8 sm:flex sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Admin Command Center</h1>
              <p className="mt-2 text-sm text-red-100 font-medium">
                Welcome back, {session.user.name || 'Admin'}! Here is what's happening in your store today.
              </p>
            </div>
            <div className="mt-6 sm:mt-0 flex gap-3">
              <Link href="/products" className="inline-flex items-center px-4 py-2 bg-white/10 border border-white/20 text-sm font-semibold rounded-lg text-white hover:bg-white/20 transition backdrop-blur-sm">
                View Storefront
              </Link>
              <Link href="/dashboard" className="inline-flex items-center px-4 py-2 bg-white text-red-700 border border-transparent text-sm font-bold rounded-lg shadow-sm hover:bg-red-50 transition">
                My Profile
              </Link>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8 overflow-hidden">
          <nav className="flex overflow-x-auto divide-x divide-gray-200">
            {[
              { id: 'overview', name: 'Command Overview' },
              { id: 'orders', name: 'Legacy Orders' },
              { id: 'products', name: 'Legacy Products' },
              { id: 'users', name: 'Legacy Users' },
              { id: 'analytics', name: 'Analytics Data' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-4 px-6 text-sm font-bold whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-red-50 text-red-700 border-b-2 border-b-red-600'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'overview' && stats && (
            <div className="space-y-10">
              
              {/* Premium Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center space-x-4">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                    <UsersIcon className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Total Users</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalUsers.toLocaleString()}</p>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center space-x-4">
                  <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                    <TagIcon className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Active Products</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalProducts.toLocaleString()}</p>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center space-x-4">
                  <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
                    <ShoppingBagIcon className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Total Orders</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalOrders.toLocaleString()}</p>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center space-x-4">
                  <div className="p-3 bg-yellow-50 text-yellow-600 rounded-lg">
                    <BanknotesIcon className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Revenue</p>
                    <p className="text-2xl font-bold text-gray-900">₹{stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </div>

              {/* System Modules Grid */}
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-6">Management Modules</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  
                  {/* Catalog Area */}
                  <ModuleCard 
                    title="Products Directory" 
                    desc="Manage catalog, pricing, status, and edit details." 
                    link="/admin/products" 
                    icon={TagIcon}
                    colorClass="bg-blue-100 text-blue-700" 
                  />
                  <ModuleCard 
                    title="Category Setup" 
                    desc="Organize store navigation and product collections." 
                    link="/admin/categories" 
                    icon={FolderOpenIcon}
                    colorClass="bg-indigo-100 text-indigo-700" 
                  />
                  <ModuleCard 
                    title="Inventory Control" 
                    desc="Track stock levels and view low-stock alerts." 
                    link="/admin/inventory" 
                    icon={ArchiveBoxIcon}
                    colorClass="bg-cyan-100 text-cyan-700" 
                  />
                  <ModuleCard 
                    title="Media Library" 
                    desc="Centralized hub for product images and banners." 
                    link="/admin/media" 
                    icon={PhotoIcon}
                    colorClass="bg-fuchsia-100 text-fuchsia-700" 
                  />

                  {/* Operations & Finance */}
                  <ModuleCard 
                    title="Order Fulfillment" 
                    desc="Process, ship, and track customer purchases." 
                    link="/admin/orders" 
                    icon={ClipboardDocumentListIcon}
                    colorClass="bg-emerald-100 text-emerald-700" 
                  />
                  <ModuleCard 
                    title="Payments Hub" 
                    desc="Reconcile gateways and process customer refunds." 
                    link="/admin/payments" 
                    icon={CreditCardIcon}
                    colorClass="bg-teal-100 text-teal-700" 
                  />
                  <ModuleCard 
                    title="Tax Rules" 
                    desc="Configure GST, SGST, and pricing compliance." 
                    link="/admin/taxes" 
                    icon={ScaleIcon}
                    colorClass="bg-sky-100 text-sky-700" 
                  />
                  
                  {/* CRM & Security */}
                  <ModuleCard 
                    title="Customers" 
                    desc="View user profiles, lock accounts, and set roles." 
                    link="/admin/users" 
                    icon={UsersIcon}
                    colorClass="bg-violet-100 text-violet-700" 
                  />
                  <ModuleCard 
                    title="Support Inbox" 
                    desc="Handle customer inquiries and contact forms." 
                    link="/admin/messages" 
                    icon={ChatBubbleLeftRightIcon}
                    colorClass="bg-pink-100 text-pink-700" 
                  />
                  <ModuleCard 
                    title="Audit Logs" 
                    desc="Track admin actions and system security events." 
                    link="/admin/security" 
                    icon={ShieldCheckIcon}
                    colorClass="bg-rose-100 text-rose-700" 
                  />
                </div>
              </div>

              {/* Data Lists: Recent Orders & Low Stock */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                
                {/* Recent Orders List */}
                <div className="xl:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">Recent Transactions</h3>
                    <Link href="/admin/orders" className="text-sm font-bold text-red-600 hover:text-red-800 flex items-center">
                      View all <ArrowRightIcon className="h-4 w-4 ml-1" />
                    </Link>
                  </div>
                  <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
                    <ul className="divide-y divide-gray-100">
                      {stats.recentOrders.length === 0 ? (
                        <li className="px-6 py-8 text-center text-sm text-gray-500">No recent orders to display.</li>
                      ) : (
                        stats.recentOrders.slice(0, 5).map((order) => (
                          <li key={order.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-bold text-gray-900">#{order.orderNumber}</p>
                                <p className="text-xs text-gray-500 mt-1">{order.user.email}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-gray-900 mb-1">₹{order.totalAmount.toFixed(2)}</p>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wide ${getStatusColor(order.status)}`}>
                                  {order.status}
                                </span>
                              </div>
                            </div>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>

                {/* Low Stock Alert List */}
                {stats.lowStockProducts.length > 0 && (
                  <div className="xl:col-span-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Inventory Alerts</h3>
                    <div className="bg-white border border-red-200 rounded-xl shadow-sm overflow-hidden h-[calc(100%-2.5rem)]">
                      <div className="bg-red-50 px-4 py-3 border-b border-red-100 flex items-center">
                        <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mr-2" />
                        <h4 className="text-sm font-bold text-red-900">Low Stock Warning</h4>
                      </div>
                      <ul className="divide-y divide-gray-100 p-2">
                        {stats.lowStockProducts.map((product) => (
                          <li key={product.id} className="flex justify-between items-center px-4 py-3 text-sm hover:bg-gray-50 rounded-lg">
                            <span className="text-gray-900 font-medium truncate pr-4">{product.name}</span>
                            <span className="text-red-700 bg-red-100 border border-red-200 px-2 py-0.5 rounded font-bold whitespace-nowrap">
                              {product.stock} left
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="p-4 border-t border-gray-100 bg-gray-50 text-center">
                        <Link href="/admin/inventory" className="text-sm font-bold text-red-600 hover:text-red-800">
                          Restock Inventory &rarr;
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* === LEGACY TABS PRESERVED === */}
          
          {activeTab === 'orders' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl mb-6 flex justify-between items-center">
                <p className="text-sm text-blue-800 font-medium">This is the legacy orders view. A detailed dedicated Orders page is being built.</p>
                <Link href="/admin/orders" className="text-sm font-bold text-blue-700 hover:underline">Open New Module &rarr;</Link>
              </div>
              <div className="bg-white shadow-sm border border-gray-200 overflow-hidden sm:rounded-xl">
                <ul className="divide-y divide-gray-200">
                  {orders.map((order) => (
                    <li key={order.id} className="px-6 py-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-gray-900">#{order.orderNumber}</p>
                          <p className="text-xs text-gray-500 mt-1">{new Date(order.createdAt).toLocaleDateString()}</p>
                          <p className="text-sm text-gray-600 mt-2">{order.user.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900 mb-3">₹{order.totalAmount.toFixed(2)}</p>
                          <select
                            value={order.status}
                            onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                            className="text-xs font-bold border border-gray-300 rounded px-2 py-1 uppercase bg-white shadow-sm focus:ring-red-500 focus:border-red-500"
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
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl mb-6 flex justify-between items-center">
                <p className="text-sm text-yellow-800 font-medium">Product management has moved to a dedicated directory.</p>
                <Link href="/admin/products" className="text-sm font-bold text-yellow-800 hover:underline bg-yellow-100 px-4 py-2 rounded-lg">Open Products Page</Link>
              </div>
              <div className="bg-white shadow-sm border border-gray-200 overflow-hidden sm:rounded-xl opacity-50 pointer-events-none">
                <ul className="divide-y divide-gray-200">
                  {products.map((product) => (
                    <li key={product.id} className="px-6 py-4">
                      <div className="flex justify-between">
                        <div>
                          <p className="text-sm font-bold text-gray-900">{product.name}</p>
                          <p className="text-xs text-gray-500 mt-1">{product.category.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">₹{product.price} <span className="text-gray-400 font-normal ml-2">Stock: {product.stock}</span></p>
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
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl mb-6 flex justify-between items-center">
                <p className="text-sm text-yellow-800 font-medium">User management has moved to a dedicated directory.</p>
                <Link href="/admin/users" className="text-sm font-bold text-yellow-800 hover:underline bg-yellow-100 px-4 py-2 rounded-lg">Open Users Page</Link>
              </div>
              <div className="bg-white shadow-sm border border-gray-200 overflow-hidden sm:rounded-xl opacity-50 pointer-events-none">
                <ul className="divide-y divide-gray-200">
                  {users.map((user) => (
                    <li key={user.id} className="px-6 py-4 flex justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{user.name || 'No name'}</p>
                        <p className="text-xs text-gray-500 mt-1">{user.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">{user.role}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && stats && (
            <div className="space-y-8">
              <h2 className="text-2xl font-bold text-gray-900">Financial Overview</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-6 border-b pb-4">Revenue Breakdown</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Gross Revenue</span>
                      <span className="text-xl font-bold text-gray-900">₹{stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Average Order Value (AOV)</span>
                      <span className="text-xl font-bold text-blue-600">
                        ₹{stats.totalOrders > 0 ? (stats.totalRevenue / stats.totalOrders).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-6 border-b pb-4">Store Health</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Products Listed</span>
                      <span className="text-xl font-bold text-gray-900">{stats.totalProducts}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Low Stock Flags</span>
                      <span className="text-xl font-bold text-red-600">{stats.lowStockProducts.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}