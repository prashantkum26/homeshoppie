'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import toast from 'react-hot-toast'

interface Order {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  createdAt: string
  orderItems: {
    id: string
    name: string
    quantity: number
    price: number
  }[]
}

interface UserProfile {
  id: string
  name: string | null
  email: string
  phone: string | null
  image: string | null
}

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('overview')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    let isMounted = true
    
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    const fetchUserData = async () => {
      if (!isMounted || status !== 'authenticated' || !session?.user) return
      
      try {
        // Fetch both profile and orders concurrently to reduce calls
        const [profileRes, ordersRes] = await Promise.all([
          fetch('/api/user/profile'),
          fetch('/api/user/orders')
        ])
        
        if (!isMounted) return // Check if component is still mounted
        
        if (profileRes.ok) {
          const profileData = await profileRes.json()
          if (isMounted) setProfile(profileData)
        }

        if (ordersRes.ok) {
          const ordersData = await ordersRes.json()
          if (isMounted) setOrders(ordersData)
        }
      } catch (error) {
        console.error('Error fetching user data:', error)
        if (isMounted) {
          toast.error('Failed to load user data')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    if (status === 'authenticated' && session?.user) {
      fetchUserData()
    }

    return () => {
      isMounted = false
    }
  }, [status, session?.user?.id, router]) // Only depend on essential values

  const handleProfileUpdate = async (formData: FormData) => {
    try {
      setIsUpdating(true)
      
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.get('name'),
          phone: formData.get('phone'),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update profile')
      }

      const updatedProfile = await response.json()
      setProfile(updatedProfile)
      toast.success('Profile updated successfully')
    } catch (error) {
      toast.error('Failed to update profile')
    } finally {
      setIsUpdating(false)
    }
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
          <div className="bg-white px-4 py-5 border-b border-gray-200 sm:px-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Welcome back, {profile?.name || session.user.name || 'User'}!
                </p>
              </div>
              <div className="flex items-center space-x-4">
                {session.user.role === 'ADMIN' && (
                  <Link
                    href="/admin"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                  >
                    Admin Panel
                  </Link>
                )}
                <Link
                  href="/cart"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  View Cart
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
                { id: 'profile', name: 'Profile' },
                { id: 'addresses', name: 'Addresses' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-green-500 text-green-600'
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
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-green-50 p-6 rounded-lg">
                  <h3 className="text-lg font-medium text-green-900">Total Orders</h3>
                  <p className="text-3xl font-bold text-green-600">{orders.length}</p>
                </div>
                <div className="bg-blue-50 p-6 rounded-lg">
                  <h3 className="text-lg font-medium text-blue-900">Total Spent</h3>
                  <p className="text-3xl font-bold text-blue-600">
                    ₹{orders.reduce((sum, order) => sum + order.totalAmount, 0).toFixed(2)}
                  </p>
                </div>
                <div className="bg-purple-50 p-6 rounded-lg">
                  <h3 className="text-lg font-medium text-purple-900">Recent Order</h3>
                  <p className="text-xl font-bold text-purple-600">
                    {orders.length > 0 ? orders[0].orderNumber : 'No orders yet'}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-gray-900">Order History</h2>
                  <Link
                    href="/products"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                  >
                    Continue Shopping
                  </Link>
                </div>

                {orders.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-24 h-24 mx-auto mb-6 text-gray-300">
                      <svg fill="currentColor" viewBox="0 0 24 24">
                        <path d="M7 4V2C7 1.45 7.45 1 8 1H16C16.55 1 17 1.45 17 2V4H20C20.55 4 21 4.45 21 5S20.55 6 20 6H19V19C19 20.1 18.1 21 17 21H7C5.9 21 5 20.1 5 19V6H4C3.45 6 3 5.55 3 5S3.45 4 4 4H7ZM9 3V4H15V3H9ZM7 6V19H17V6H7Z"/>
                      </svg>
                    </div>
                    <h3 className="text-xl font-medium text-gray-900 mb-2">No orders yet</h3>
                    <p className="text-gray-600">Start shopping to see your orders here.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <div key={order.id} className="border border-gray-200 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">
                              Order #{order.orderNumber}
                            </h3>
                            <p className="text-sm text-gray-600">
                              Placed on {new Date(order.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                              {order.status}
                            </span>
                            <p className="mt-1 text-lg font-semibold text-gray-900">
                              ₹{order.totalAmount.toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <div className="border-t pt-4">
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Items:</h4>
                          <ul className="text-sm text-gray-600">
                            {order.orderItems.map((item) => (
                              <li key={item.id} className="flex justify-between">
                                <span>{item.name} × {item.quantity}</span>
                                <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="max-w-2xl">
                <h2 className="text-lg font-medium text-gray-900 mb-6">Profile Information</h2>
                
                <form onSubmit={(e) => {
                  e.preventDefault()
                  const formData = new FormData(e.currentTarget)
                  handleProfileUpdate(formData)
                }}>
                  <div className="space-y-6">
                    <div className="flex items-center space-x-6">
                      <div className="flex-shrink-0">
                        <div className="h-20 w-20 rounded-full bg-gray-300 flex items-center justify-center">
                          {profile?.image ? (
                            <Image
                              src={profile.image}
                              alt={profile.name || 'User'}
                              width={80}
                              height={80}
                              className="rounded-full"
                            />
                          ) : (
                            <svg className="h-8 w-8 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">Profile Picture</h3>
                        <p className="text-sm text-gray-600">Update your profile picture</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                          Full Name
                        </label>
                        <input
                          type="text"
                          name="name"
                          id="name"
                          defaultValue={profile?.name || ''}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm px-3 py-2 border"
                        />
                      </div>

                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                          Email Address
                        </label>
                        <input
                          type="email"
                          name="email"
                          id="email"
                          value={profile?.email || ''}
                          disabled
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-50 sm:text-sm px-3 py-2 border"
                        />
                        <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
                      </div>

                      <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          id="phone"
                          defaultValue={profile?.phone || ''}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm px-3 py-2 border"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isUpdating}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                      >
                        {isUpdating ? 'Updating...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'addresses' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-medium text-gray-900">Saved Addresses</h2>
                  <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700">
                    Add New Address
                  </button>
                </div>
                
                <div className="text-center py-12">
                  <div className="w-24 h-24 mx-auto mb-6 text-gray-300">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-medium text-gray-900 mb-2">No addresses saved</h3>
                  <p className="text-gray-600">Add an address to make checkout faster.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
