'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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
    unitPrice: number
  }[]
}

interface UserProfile {
  id: string
  name: string | null
  email: string
  phone: string | null
  image: string | null
}

interface Address {
  id: string
  name: string
  phone: string
  street1: string
  street2?: string
  city: string
  state: string
  postalCode: string
  landmark?: string
  type: 'HOME' | 'WORK' | 'OTHER'
  isDefault: boolean
}

type TabId = 'overview' | 'orders' | 'profile' | 'addresses'

const tabs: { id: TabId; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'grid' },
  { id: 'orders', label: 'My Orders', icon: 'bag' },
  { id: 'profile', label: 'Profile', icon: 'user' },
  { id: 'addresses', label: 'Addresses', icon: 'pin' },
]

const statusStyles: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  CONFIRMED: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  PROCESSING: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  SHIPPED: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  DELIVERED: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  CANCELLED: 'bg-rose-50 text-rose-700 ring-rose-600/20',
}

function Icon({
  name,
  className = 'h-5 w-5',
}: {
  name: string
  className?: string
}) {
  const common = {
    className,
    fill: 'none',
    viewBox: '0 0 24 24',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  const paths: Record<string, React.ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    bag: (
      <>
        <path d="M6 8h12l1 13H5L6 8Z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 21a7 7 0 0 1 14 0" />
      </>
    ),
    pin: (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    cart: (
      <>
        <path d="M3 4h2l2 12h10l2-8H6" />
        <circle cx="9" cy="20" r="1" />
        <circle cx="17" cy="20" r="1" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 20 6v5c0 5-3.3 8.5-8 10-4.7-1.5-8-5-8-10V6l8-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    edit: (
      <>
        <path d="m4 16 10-10 4 4L8 20H4v-4Z" />
        <path d="m13 7 4 4" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16" />
        <path d="M9 7V4h6v3M7 7l1 13h8l1-13" />
        <path d="M10 11v5M14 11v5" />
      </>
    ),
    close: <path d="M6 6l12 12M18 6 6 18" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    lock: (
      <>
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    phone: (
      <path d="M6 3h3l1.5 4-2 1.5a15 15 0 0 0 7 7l1.5-2 4 1.5v3a2 2 0 0 1-2 2C10.7 19.5 4.5 13.3 4 5a2 2 0 0 1 2-2Z" />
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    home: (
      <>
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v10h14V10M9 20v-6h6v6" />
      </>
    ),
    briefcase: (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
      </>
    ),
  }

  return <svg {...common}>{paths[name] ?? paths.grid}</svg>
}

function formatCurrency(value: number) {
  return `₹${Number(value || 0).toFixed(2)}`
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getInitials(name?: string | null) {
  if (!name) return 'U'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function getStatusLabel(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase()
}

function AddressTypeIcon({ type }: { type: Address['type'] }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
      <Icon
        name={type === 'HOME' ? 'home' : type === 'WORK' ? 'briefcase' : 'pin'}
        className="h-5 w-5"
      />
    </span>
  )
}

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [addresses, setAddresses] = useState<Address[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [editingAddress, setEditingAddress] = useState<Address | null>(null)
  const [isSavingAddress, setIsSavingAddress] = useState(false)
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    const fetchUserData = async () => {
      if (!isMounted || status !== 'authenticated' || !session?.user) return

      try {
        setIsLoading(true)

        const [profileRes, ordersRes, addressesRes] = await Promise.all([
          fetch('/api/user/profile'),
          fetch('/api/user/orders'),
          fetch('/api/user/addresses'),
        ])

        if (!isMounted) return

        if (profileRes.ok) setProfile(await profileRes.json())
        if (ordersRes.ok) setOrders(await ordersRes.json())
        if (addressesRes.ok) setAddresses(await addressesRes.json())
      } catch (error) {
        console.error('Error fetching user data:', error)
        if (isMounted) toast.error('Failed to load dashboard data')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    if (status === 'authenticated' && session?.user) fetchUserData()

    return () => {
      isMounted = false
    }
  }, [status, session?.user?.id, router])

  const deliveredOrders = useMemo(
    () => orders.filter((order) => order.status === 'DELIVERED').length,
    [orders],
  )

  const totalSpent = useMemo(
    () => orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
    [orders],
  )

  const recentOrders = useMemo(() => orders.slice(0, 3), [orders])

  const displayName = profile?.name || session?.user?.name || 'User'
  const displayImage = profile?.image || session?.user?.image

  const handleProfileUpdate = async (formData: FormData) => {
    try {
      setIsUpdating(true)

      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          phone: formData.get('phone'),
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Failed to update profile')
      }

      setProfile(await response.json())
      toast.success('Profile updated successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update profile')
    } finally {
      setIsUpdating(false)
    }
  }

  const openAddAddress = () => {
    setEditingAddress(null)
    setShowAddressForm(true)
  }

  const openEditAddress = (address: Address) => {
    setEditingAddress(address)
    setShowAddressForm(true)
  }

  const closeAddressForm = () => {
    setShowAddressForm(false)
    setEditingAddress(null)
  }

  const handleDeleteAddress = async (address: Address) => {
    if (deletingAddressId) return

    const confirmed = window.confirm(
      `Delete this ${address.type.toLowerCase()} address?\n\n${address.street1}, ${address.city}`,
    )

    if (!confirmed) return

    try {
      setDeletingAddressId(address.id)

      const response = await fetch(`/api/user/addresses/${address.id}`, {
        method: 'DELETE',
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        // Your API already returns:
        // { error: "...", pendingOrders: 2 }
        const pendingOrders = Number(data?.pendingOrders || 0)

        if (pendingOrders > 0) {
          toast.error(
            `This address is linked to ${pendingOrders} pending order${
              pendingOrders === 1 ? '' : 's'
            }. It cannot be deleted until those orders are completed or cancelled.`,
            { duration: 5000 },
          )
        } else {
          toast.error(data?.error || 'Unable to delete address')
        }
        return
      }

      setAddresses((current) => current.filter((item) => item.id !== address.id))
      toast.success('Address deleted successfully')
    } catch (error) {
      console.error('Delete address error:', error)
      toast.error('Something went wrong while deleting the address')
    } finally {
      setDeletingAddressId(null)
    }
  }

  const handleSetDefault = async (address: Address) => {
    try {
      const response = await fetch(`/api/user/addresses/${address.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        toast.error(data?.error || 'Failed to update default address')
        return
      }

      setAddresses((current) =>
        current.map((item) => ({
          ...item,
          isDefault: item.id === address.id,
        })),
      )

      toast.success('Default address updated')
    } catch (error) {
      console.error('Set default address error:', error)
      toast.error('Failed to update default address')
    }
  }

  const handleAddressSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    try {
      setIsSavingAddress(true)

      const formData = new FormData(event.currentTarget)
      const addressData = {
        name: formData.get('name'),
        phone: formData.get('phone'),
        street1: formData.get('street1'),
        street2: formData.get('street2'),
        city: formData.get('city'),
        state: formData.get('state'),
        postalCode: formData.get('postalCode'),
        landmark: formData.get('landmark'),
        type: formData.get('type'),
        isDefault: formData.get('isDefault') === 'on',
      }

      const url = editingAddress
        ? `/api/user/addresses/${editingAddress.id}`
        : '/api/user/addresses'

      const response = await fetch(url, {
        method: editingAddress ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addressData),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        toast.error(data?.error || 'Failed to save address')
        return
      }

      const savedAddress = data as Address

      setAddresses((current) => {
        if (editingAddress) {
          if (savedAddress.isDefault) {
            return current.map((item) => ({
              ...item,
              isDefault: item.id === savedAddress.id,
            })).map((item) =>
              item.id === savedAddress.id ? savedAddress : item,
            )
          }

          return current.map((item) =>
            item.id === editingAddress.id ? savedAddress : item,
          )
        }

        if (savedAddress.isDefault) {
          return [
            ...current.map((item) => ({ ...item, isDefault: false })),
            savedAddress,
          ]
        }

        return [...current, savedAddress]
      })

      toast.success(
        editingAddress ? 'Address updated successfully' : 'Address added successfully',
      )
      closeAddressForm()
    } catch (error) {
      console.error('Save address error:', error)
      toast.error('Something went wrong while saving the address')
    } finally {
      setIsSavingAddress(false)
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-6">
            <div className="h-44 rounded-3xl bg-slate-200" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-28 rounded-2xl bg-slate-200" />
              ))}
            </div>
            <div className="h-80 rounded-2xl bg-slate-200" />
          </div>
        </div>
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 px-6 py-7 text-white shadow-xl shadow-emerald-900/10 sm:px-8 sm:py-9">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-teal-300/10 blur-3xl" />

          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/15 ring-2 ring-white/20 backdrop-blur sm:h-20 sm:w-20">
                {displayImage ? (
                  <Image
                    src={displayImage}
                    alt={displayName}
                    width={80}
                    height={80}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-bold">{getInitials(displayName)}</span>
                )}
              </div>

              <div>
                <p className="mb-1 text-sm font-medium text-emerald-100">
                  Customer account
                </p>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Welcome back, {displayName.split(' ')[0]}!
                </h1>
                <p className="mt-1 max-w-xl text-sm text-emerald-50/90">
                  Manage your orders, profile and saved delivery addresses in one place.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/products"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50"
              >
                <Icon name="bag" className="h-4 w-4" />
                Continue Shopping
              </Link>

              <Link
                href="/cart"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                <Icon name="cart" className="h-4 w-4" />
                View Cart
              </Link>

              {session.user.role === 'ADMIN' && (
                <Link
                  href="/admin"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-black/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black/20"
                >
                  <Icon name="shield" className="h-4 w-4" />
                  Admin
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: 'Total Orders',
              value: orders.length,
              icon: 'bag',
              description: 'All your orders',
              iconClass: 'bg-emerald-50 text-emerald-600',
            },
            {
              label: 'Total Spent',
              value: formatCurrency(totalSpent),
              icon: 'cart',
              description: 'Across all orders',
              iconClass: 'bg-blue-50 text-blue-600',
            },
            {
              label: 'Delivered',
              value: deliveredOrders,
              icon: 'check',
              description: 'Successfully delivered',
              iconClass: 'bg-violet-50 text-violet-600',
            },
            {
              label: 'Saved Addresses',
              value: addresses.length,
              icon: 'pin',
              description: 'Delivery locations',
              iconClass: 'bg-amber-50 text-amber-600',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{stat.description}</p>
                </div>
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.iconClass}`}>
                  <Icon name={stat.icon} className="h-5 w-5" />
                </span>
              </div>
            </div>
          ))}
        </section>

        {/* Main panel */}
        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Tabs */}
          <div className="border-b border-slate-200 bg-white">
            <nav className="flex overflow-x-auto px-3 sm:px-5" aria-label="Dashboard sections">
              {tabs.map((tab) => {
                const active = activeTab === tab.id

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex shrink-0 items-center gap-2 px-4 py-4 text-sm font-semibold transition sm:px-5 ${
                      active
                        ? 'text-emerald-700'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Icon name={tab.icon} className="h-4 w-4" />
                    {tab.label}
                    {tab.id === 'orders' && orders.length > 0 && (
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                        {orders.length}
                      </span>
                    )}
                    {active && (
                      <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-emerald-600" />
                    )}
                  </button>
                )
              })}
            </nav>
          </div>

          <div className="p-5 sm:p-7">
            {/* Overview */}
            {activeTab === 'overview' && (
              <div className="space-y-7">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                  <div>
                    <p className="text-sm font-semibold text-emerald-600">Account overview</p>
                    <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                      Everything at a glance
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Quickly access your latest orders and account details.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('orders')}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    View all orders
                    <Icon name="arrow" className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900">Recent orders</h3>
                        <p className="mt-0.5 text-xs text-slate-500">Your latest activity</p>
                      </div>
                      <Icon name="clock" className="h-5 w-5 text-slate-400" />
                    </div>

                    {recentOrders.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
                        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                          <Icon name="bag" className="h-6 w-6" />
                        </span>
                        <h4 className="mt-4 font-semibold text-slate-900">No orders yet</h4>
                        <p className="mt-1 text-sm text-slate-500">
                          Your recent orders will appear here.
                        </p>
                        <Link
                          href="/products"
                          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                        >
                          Start Shopping
                          <Icon name="arrow" className="h-4 w-4" />
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {recentOrders.map((order) => (
                          <button
                            key={order.id}
                            type="button"
                            onClick={() => setActiveTab('orders')}
                            className="group flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-200 hover:shadow-sm"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-bold text-slate-900">
                                  #{order.orderNumber}
                                </p>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                                    statusStyles[order.status] || 'bg-slate-50 text-slate-600 ring-slate-500/20'
                                  }`}
                                >
                                  {getStatusLabel(order.status)}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-slate-500">
                                {formatDate(order.createdAt)} · {order.orderItems.length} item
                                {order.orderItems.length === 1 ? '' : 's'}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              <p className="text-sm font-bold text-slate-900">
                                {formatCurrency(order.totalAmount)}
                              </p>
                              <Icon
                                name="chevron"
                                className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-500"
                              />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl bg-slate-900 p-6 text-white">
                    <div className="flex h-full flex-col">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                        <Icon name="shield" className="h-5 w-5" />
                      </span>
                      <h3 className="mt-5 text-xl font-bold">Account details</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        Keep your profile and delivery information up to date for a smoother checkout.
                      </p>

                      <div className="mt-6 space-y-3 border-t border-white/10 pt-5">
                        <div className="flex items-center gap-3 text-sm">
                          <Icon name="mail" className="h-4 w-4 text-slate-400" />
                          <span className="truncate text-slate-200">{profile?.email || session.user.email}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <Icon name="phone" className="h-4 w-4 text-slate-400" />
                          <span className="text-slate-200">{profile?.phone || 'Phone not added'}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTab('profile')}
                        className="mt-auto inline-flex w-fit items-center gap-2 pt-7 text-sm font-semibold text-emerald-300 hover:text-emerald-200"
                      >
                        Manage profile
                        <Icon name="arrow" className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Orders */}
            {activeTab === 'orders' && (
              <div className="space-y-6">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm font-semibold text-emerald-600">Purchase history</p>
                    <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                      My Orders
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Track your purchases and review order details.
                    </p>
                  </div>

                  <Link
                    href="/products"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                  >
                    <Icon name="plus" className="h-4 w-4" />
                    Shop More
                  </Link>
                </div>

                {orders.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-16 text-center">
                    <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                      <Icon name="bag" className="h-7 w-7" />
                    </span>
                    <h3 className="mt-5 text-xl font-bold text-slate-900">No orders yet</h3>
                    <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                      Once you place an order, you can track its status and review the items here.
                    </p>
                    <Link
                      href="/products"
                      className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      Explore Products
                      <Icon name="arrow" className="h-4 w-4" />
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <article
                        key={order.id}
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:shadow-md"
                      >
                        <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold text-slate-900">
                                Order #{order.orderNumber}
                              </h3>
                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ${
                                  statusStyles[order.status] || 'bg-slate-50 text-slate-600 ring-slate-500/20'
                                }`}
                              >
                                {getStatusLabel(order.status)}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              Placed on {formatDate(order.createdAt)}
                            </p>
                          </div>
                          <div className="sm:text-right">
                            <p className="text-xs font-medium text-slate-500">Order total</p>
                            <p className="mt-0.5 text-xl font-bold text-slate-900">
                              {formatCurrency(order.totalAmount)}
                            </p>
                          </div>
                        </div>

                        <div className="divide-y divide-slate-100 px-5">
                          {order.orderItems.map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-4 py-4">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-800">
                                  {item.name}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  Quantity: {item.quantity}
                                </p>
                              </div>
                              <p className="shrink-0 text-sm font-semibold text-slate-700">
                                {formatCurrency(item.unitPrice * item.quantity)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Profile */}
            {activeTab === 'profile' && (
              <div className="mx-auto max-w-3xl">
                <div className="mb-7">
                  <p className="text-sm font-semibold text-emerald-600">Account settings</p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                    Profile Information
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Update the information used for your account and orders.
                  </p>
                </div>

                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    handleProfileUpdate(new FormData(event.currentTarget))
                  }}
                  className="overflow-hidden rounded-2xl border border-slate-200"
                >
                  <div className="bg-slate-50/70 p-5 sm:p-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-100 text-2xl font-bold text-emerald-700 ring-4 ring-white shadow-sm">
                        {displayImage ? (
                          <Image
                            src={displayImage}
                            alt={displayName}
                            width={80}
                            height={80}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          getInitials(displayName)
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{displayName}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Your profile picture is managed through your account provider.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
                    <div>
                      <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-slate-700">
                        Full Name
                      </label>
                      <input
                        type="text"
                        name="name"
                        id="name"
                        defaultValue={profile?.name || ''}
                        required
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                      />
                    </div>

                    <div>
                      <label htmlFor="phone" className="mb-1.5 block text-sm font-semibold text-slate-700">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        id="phone"
                        defaultValue={profile?.phone || ''}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-slate-700">
                        Email Address
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          id="email"
                          value={profile?.email || session.user.email || ''}
                          disabled
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 pr-11 text-sm text-slate-500"
                        />
                        <Icon name="lock" className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      </div>
                      <p className="mt-1.5 text-xs text-slate-400">
                        Email address cannot be changed here.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end border-t border-slate-100 bg-slate-50/50 px-5 py-4 sm:px-6">
                    <button
                      type="submit"
                      disabled={isUpdating}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isUpdating ? 'Saving...' : 'Save Changes'}
                      {!isUpdating && <Icon name="check" className="h-4 w-4" />}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Addresses */}
            {activeTab === 'addresses' && (
              <div>
                <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm font-semibold text-emerald-600">Delivery settings</p>
                    <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                      Saved Addresses
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Save your frequently used delivery locations for faster checkout.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={openAddAddress}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                  >
                    <Icon name="plus" className="h-4 w-4" />
                    Add New Address
                  </button>
                </div>

                {addresses.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-16 text-center">
                    <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                      <Icon name="pin" className="h-7 w-7" />
                    </span>
                    <h3 className="mt-5 text-xl font-bold text-slate-900">No saved addresses</h3>
                    <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                      Add a delivery address so checkout is faster next time.
                    </p>
                    <button
                      type="button"
                      onClick={openAddAddress}
                      className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      <Icon name="plus" className="h-4 w-4" />
                      Add Your First Address
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {addresses.map((address) => (
                      <article
                        key={address.id}
                        className={`relative rounded-2xl border bg-white p-5 transition hover:shadow-md ${
                          address.isDefault
                            ? 'border-emerald-300 ring-1 ring-emerald-100'
                            : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <AddressTypeIcon type={address.type} />

                          <div className="min-w-0 flex-1 pr-12">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold text-slate-900">{address.name}</h3>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                                {address.type}
                              </span>
                              {address.isDefault && (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                              <Icon name="phone" className="h-3.5 w-3.5" />
                              {address.phone}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                          <p>{address.street1}</p>
                          {address.street2 && <p>{address.street2}</p>}
                          {address.landmark && <p>Near {address.landmark}</p>}
                          <p className="font-medium text-slate-700">
                            {address.city}, {address.state} - {address.postalCode}
                          </p>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-4">
                          <button
                            type="button"
                            onClick={() => openEditAddress(address)}
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                          >
                            <Icon name="edit" className="h-4 w-4" />
                            Edit
                          </button>

                          {!address.isDefault && (
                            <button
                              type="button"
                              onClick={() => handleSetDefault(address)}
                              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-800"
                            >
                              <Icon name="check" className="h-4 w-4" />
                              Set Default
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteAddress(address)}
                            disabled={deletingAddressId === address.id}
                            className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Icon name="trash" className="h-4 w-4" />
                            {deletingAddressId === address.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Address modal */}
      {showAddressForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeAddressForm()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="address-modal-title"
            className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                  Delivery address
                </p>
                <h3 id="address-modal-title" className="mt-0.5 text-lg font-bold text-slate-900">
                  {editingAddress ? 'Edit Address' : 'Add New Address'}
                </h3>
              </div>

              <button
                type="button"
                onClick={closeAddressForm}
                disabled={isSavingAddress}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                aria-label="Close"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddressSubmit}>
              <div className="max-h-[65vh] overflow-y-auto p-5 sm:p-6">
                <div className="grid gap-5 sm:grid-cols-2">
                  {[
                    ['name', 'Full Name', editingAddress?.name || '', 'text'],
                    ['phone', 'Phone Number', editingAddress?.phone || '', 'tel'],
                  ].map(([name, label, value, type]) => (
                    <div key={name}>
                      <label htmlFor={name} className="mb-1.5 block text-sm font-semibold text-slate-700">
                        {label} *
                      </label>
                      <input
                        id={name}
                        name={name}
                        type={type}
                        defaultValue={value}
                        required
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                      />
                    </div>
                  ))}

                  <div className="sm:col-span-2">
                    <label htmlFor="street1" className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Address Line 1 *
                    </label>
                    <input
                      id="street1"
                      name="street1"
                      type="text"
                      defaultValue={editingAddress?.street1 || ''}
                      required
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="street2" className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Address Line 2
                    </label>
                    <input
                      id="street2"
                      name="street2"
                      type="text"
                      defaultValue={editingAddress?.street2 || ''}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                    />
                  </div>

                  <div>
                    <label htmlFor="city" className="mb-1.5 block text-sm font-semibold text-slate-700">
                      City *
                    </label>
                    <input
                      id="city"
                      name="city"
                      type="text"
                      defaultValue={editingAddress?.city || ''}
                      required
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                    />
                  </div>

                  <div>
                    <label htmlFor="state" className="mb-1.5 block text-sm font-semibold text-slate-700">
                      State *
                    </label>
                    <input
                      id="state"
                      name="state"
                      type="text"
                      defaultValue={editingAddress?.state || ''}
                      required
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                    />
                  </div>

                  <div>
                    <label htmlFor="postalCode" className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Postal Code *
                    </label>
                    <input
                      id="postalCode"
                      name="postalCode"
                      type="text"
                      inputMode="numeric"
                      defaultValue={editingAddress?.postalCode || ''}
                      required
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                    />
                  </div>

                  <div>
                    <label htmlFor="type" className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Address Type *
                    </label>
                    <select
                      id="type"
                      name="type"
                      defaultValue={editingAddress?.type || 'HOME'}
                      required
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                    >
                      <option value="HOME">Home</option>
                      <option value="WORK">Work</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="landmark" className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Landmark
                    </label>
                    <input
                      id="landmark"
                      name="landmark"
                      type="text"
                      defaultValue={editingAddress?.landmark || ''}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                    />
                  </div>

                  <label className="sm:col-span-2 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <input
                      type="checkbox"
                      name="isDefault"
                      defaultChecked={editingAddress?.isDefault || false}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">
                        Set as default address
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        Use this address automatically during checkout.
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:px-6">
                <button
                  type="button"
                  onClick={closeAddressForm}
                  disabled={isSavingAddress}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingAddress}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingAddress
                    ? 'Saving...'
                    : editingAddress
                      ? 'Update Address'
                      : 'Save Address'}
                  {!isSavingAddress && <Icon name="check" className="h-4 w-4" />}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
