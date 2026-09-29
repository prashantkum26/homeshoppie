'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircleIcon,
  TruckIcon,
  ClockIcon,
  MapPinIcon,
  CreditCardIcon,
  ShoppingBagIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import useCartStore from '@/store/cartStore'

interface OrderItem {
  id: string
  orderId: string
  productId: string
  name: string
  sku: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  productSnapshot: unknown | null
  fulfilled: boolean
  fulfilledAt: string | null
}

interface Address {
  id: string
  userId: string
  name: string
  phone: string
  email: string | null
  street1: string
  street2: string | null
  city: string
  state: string
  postalCode: string
  country: string
  landmark: string | null
  type: string
  isDefault: boolean
  isValidated: boolean
  validatedAt: string | null
}

interface PaymentLog {
  id: string
  status: string
  method: string | null
  razorpayOrderId: string | null
  razorpayPaymentId: string | null
  failureReason: string | null
  createdAt: string
}

interface Order {
  id: string
  orderNumber: string
  userId: string
  addressId: string

  status: string
  fulfillmentStatus: string

  paymentMethod: string
  paymentStatus: string
  paymentIntentId: string | null

  subtotalAmount: number
  taxAmount: number
  shippingFee: number
  discountAmount: number
  totalAmount: number

  taxBreakdown: string
  taxRate: number | null

  shippingMethod: string | null
  trackingNumber: string | null
  estimatedDelivery: string | null
  deliveredAt: string | null

  notes: string | null
  internalNotes: string | null
  source: string | null

  cancelledAt: string | null
  cancelledBy: string | null
  cancelReason: string | null

  deletedAt: string | null
  deletedBy: string | null

  version: number
  createdAt: string
  updatedAt: string

  orderItems: OrderItem[]
  address: Address
  paymentLogs: PaymentLog[]
}

function OrderSuccessContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = searchParams.get('orderId')

  const { clearCart } = useCartStore()

  const [order, setOrder] = useState<Order | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (status === 'loading') return

    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (!orderId) {
      router.push('/dashboard')
      return
    }

    fetchOrder()
  }, [status, orderId, router])

  const fetchOrder = async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        cache: 'no-store',
      })

      if (response.ok) {
        const orderData: Order = await response.json()

        setOrder(orderData)

        // Clear cart only after successfully retrieving the order.
        clearCart()
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const getPaymentMethodLabel = (method: string) => {
    switch (method?.toLowerCase()) {
      case 'card':
        return 'Credit / Debit Card'
      case 'upi':
        return 'UPI'
      case 'netbanking':
        return 'Net Banking'
      case 'wallet':
        return 'Wallet'
      case 'cod':
        return 'Cash on Delivery'
      default:
        return method || 'Online Payment'
    }
  }

  const getPaymentStatusColor = (paymentStatus: string) => {
    switch (paymentStatus?.toUpperCase()) {
      case 'PAID':
      case 'SUCCESS':
        return 'bg-green-50 text-green-700 border-green-200'

      case 'PENDING':
        return 'bg-amber-50 text-amber-700 border-amber-200'

      case 'FAILED':
        return 'bg-red-50 text-red-700 border-red-200'

      case 'REFUNDED':
        return 'bg-purple-50 text-purple-700 border-purple-200'

      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const getOrderStatusColor = (orderStatus: string) => {
    switch (orderStatus?.toUpperCase()) {
      case 'CONFIRMED':
        return 'bg-green-50 text-green-700 border-green-200'

      case 'PROCESSING':
        return 'bg-blue-50 text-blue-700 border-blue-200'

      case 'SHIPPED':
        return 'bg-purple-50 text-purple-700 border-purple-200'

      case 'DELIVERED':
        return 'bg-green-50 text-green-700 border-green-200'

      case 'PENDING':
        return 'bg-amber-50 text-amber-700 border-amber-200'

      case 'CANCELLED':
        return 'bg-red-50 text-red-700 border-red-200'

      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const getFulfillmentStatusColor = (fulfillmentStatus: string) => {
    switch (fulfillmentStatus?.toUpperCase()) {
      case 'FULFILLED':
        return 'bg-green-50 text-green-700 border-green-200'

      case 'PARTIALLY_FULFILLED':
        return 'bg-blue-50 text-blue-700 border-blue-200'

      case 'UNFULFILLED':
        return 'bg-gray-50 text-gray-700 border-gray-200'

      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const getPageTitle = () => {
    if (!order) return 'Order Details'

    if (order.paymentStatus === 'PAID') {
      return 'Payment Successful!'
    }

    if (order.paymentStatus === 'FAILED') {
      return 'Payment Failed'
    }

    if (order.paymentStatus === 'PENDING') {
      return 'Order Created'
    }

    return 'Order Placed'
  }

  const getPageDescription = () => {
    if (!order) return ''

    if (order.paymentStatus === 'PAID') {
      return 'Your payment has been received and your order is being processed.'
    }

    if (order.paymentStatus === 'FAILED') {
      return 'Your payment could not be completed. Please check your payment status or try again.'
    }

    if (order.paymentStatus === 'PENDING') {
      return 'Your order has been created. Your payment is currently being processed.'
    }

    return 'Your order has been received successfully.'
  }

  const getEstimatedDelivery = () => {
    if (!order) return null

    if (order.estimatedDelivery) {
      return formatDate(order.estimatedDelivery)
    }

    // Only show an estimate for active orders.
    if (
      ['CANCELLED', 'FAILED'].includes(order.status?.toUpperCase()) ||
      order.paymentStatus?.toUpperCase() === 'FAILED'
    ) {
      return null
    }

    const deliveryDate = new Date(order.createdAt)

    // Current business rule:
    // Online payment = approximately 5 days
    // COD = approximately 7 days
    deliveryDate.setDate(
      deliveryDate.getDate() +
        (order.paymentMethod?.toLowerCase() === 'cod' ? 7 : 5)
    )

    return formatDate(deliveryDate.toISOString())
  }

  const getLatestPaymentLog = () => {
    if (!order?.paymentLogs?.length) return null

    return [...order.paymentLogs].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
    )[0]
  }

  const paymentLog = getLatestPaymentLog()

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto" />
          <p className="mt-4 text-sm text-gray-500">
            Loading your order...
          </p>
        </div>
      </div>
    )
  }

  if (!session || !order) {
    return null
  }

  const paymentPending =
    order.paymentStatus?.toUpperCase() === 'PENDING'

  const paymentFailed =
    order.paymentStatus?.toUpperCase() === 'FAILED'

  const paymentPaid =
    order.paymentStatus?.toUpperCase() === 'PAID'

  const isCancelled =
    order.status?.toUpperCase() === 'CANCELLED'

  return (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            {paymentPaid ? (
              <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircleIcon className="h-12 w-12 text-green-600" />
              </div>
            ) : paymentFailed ? (
              <div className="h-20 w-20 rounded-full bg-red-100 flex items-center justify-center">
                <ExclamationCircleIcon className="h-12 w-12 text-red-600" />
              </div>
            ) : (
              <div className="h-20 w-20 rounded-full bg-amber-100 flex items-center justify-center">
                <ClockIcon className="h-12 w-12 text-amber-600" />
              </div>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {getPageTitle()}
          </h1>

          <p className="mt-2 text-gray-600 max-w-xl mx-auto">
            {getPageDescription()}
          </p>

          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-200 shadow-sm">
            <ShoppingBagIcon className="h-5 w-5 text-gray-500" />
            <span className="text-sm text-gray-600">
              Order
            </span>
            <span className="font-semibold text-gray-900">
              #{order.orderNumber}
            </span>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Placed on {formatDateTime(order.createdAt)}
          </p>
        </div>

        {/* Payment Pending Alert */}
        {paymentPending && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <ClockIcon className="h-6 w-6 text-amber-600 flex-shrink-0" />

              <div>
                <h3 className="font-semibold text-amber-900">
                  Payment is still pending
                </h3>

                <p className="text-sm text-amber-800 mt-1">
                  Your order has been created, but the payment has not
                  been confirmed yet. Please do not create another payment
                  unless your payment actually failed.
                </p>

                {paymentLog?.razorpayOrderId && (
                  <p className="text-xs text-amber-700 mt-2">
                    Payment reference:{' '}
                    <span className="font-mono">
                      {paymentLog.razorpayOrderId}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Failed Payment Alert */}
        {paymentFailed && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <ExclamationCircleIcon className="h-6 w-6 text-red-600 flex-shrink-0" />

              <div>
                <h3 className="font-semibold text-red-900">
                  Payment was not completed
                </h3>

                <p className="text-sm text-red-800 mt-1">
                  Your order is currently not marked as paid.
                  Please check your payment details or contact support
                  if money was deducted from your account.
                </p>

                {paymentLog?.failureReason && (
                  <p className="text-sm text-red-700 mt-2">
                    Reason: {paymentLog.failureReason}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">

            {/* Current Status */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-gray-900">
                  Order Status
                </h2>

                <span className="text-xs text-gray-500">
                  v{order.version}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs text-gray-500 mb-2">
                    Order
                  </p>

                  <span
                    className={`inline-flex px-3 py-1 rounded-full border text-xs font-semibold ${getOrderStatusColor(
                      order.status
                    )}`}
                  >
                    {order.status}
                  </span>
                </div>

                <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs text-gray-500 mb-2">
                    Payment
                  </p>

                  <span
                    className={`inline-flex px-3 py-1 rounded-full border text-xs font-semibold ${getPaymentStatusColor(
                      order.paymentStatus
                    )}`}
                  >
                    {order.paymentStatus}
                  </span>
                </div>

                <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs text-gray-500 mb-2">
                    Fulfillment
                  </p>

                  <span
                    className={`inline-flex px-3 py-1 rounded-full border text-xs font-semibold ${getFulfillmentStatusColor(
                      order.fulfillmentStatus
                    )}`}
                  >
                    {order.fulfillmentStatus.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {getEstimatedDelivery() && (
                <div className="mt-5 pt-5 border-t border-gray-100 flex items-start gap-3">
                  <ClockIcon className="h-5 w-5 text-gray-400 mt-0.5" />

                  <div>
                    <p className="text-xs text-gray-500">
                      Estimated delivery
                    </p>

                    <p className="text-sm font-medium text-gray-900 mt-1">
                      {getEstimatedDelivery()}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Order Items */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-gray-900">
                  Order Items
                </h2>

                <span className="text-sm text-gray-500">
                  {order.orderItems.length}{' '}
                  {order.orderItems.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              <div className="divide-y divide-gray-100">
                {order.orderItems.map((item) => (
                  <div
                    key={item.id}
                    className="py-4 flex items-center gap-4"
                  >
                    <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <ShoppingBagIcon className="h-6 w-6 text-gray-400" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900">
                        {item.name}
                      </h3>

                      {item.sku && (
                        <p className="text-xs text-gray-500 mt-1">
                          SKU: {item.sku}
                        </p>
                      )}

                      <p className="text-sm text-gray-500 mt-1">
                        {formatCurrency(item.unitPrice)} ×{' '}
                        {item.quantity}
                      </p>
                    </div>

                    <div className="text-sm font-semibold text-gray-900">
                      {formatCurrency(item.totalPrice)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-5">
                Price Details
              </h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    Subtotal
                  </span>

                  <span className="font-medium text-gray-900">
                    {formatCurrency(order.subtotalAmount)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">
                    Tax
                  </span>

                  <span className="font-medium text-gray-900">
                    {formatCurrency(order.taxAmount)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">
                    Shipping
                  </span>

                  <span className="font-medium text-gray-900">
                    {order.shippingFee === 0
                      ? 'FREE'
                      : formatCurrency(order.shippingFee)}
                  </span>
                </div>

                {order.discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>
                      Discount
                    </span>

                    <span className="font-medium">
                      -{formatCurrency(order.discountAmount)}
                    </span>
                  </div>
                )}

                <div className="border-t border-gray-200 pt-4 mt-4">
                  <div className="flex justify-between">
                    <span className="text-base font-semibold text-gray-900">
                      Total
                    </span>

                    <span className="text-xl font-bold text-gray-900">
                      {formatCurrency(order.totalAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Delivery Information */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5">
                <MapPinIcon className="h-5 w-5 text-green-600" />

                <h2 className="text-lg font-semibold text-gray-900">
                  Delivery Information
                </h2>
              </div>

              <div className="rounded-lg bg-gray-50 border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {order.address.name}
                    </p>

                    <p className="text-sm text-gray-600 mt-1">
                      {order.address.phone}
                    </p>
                  </div>

                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-600">
                    {order.address.type}
                  </span>
                </div>

                <div className="mt-4 text-sm text-gray-700 leading-6">
                  <p>{order.address.street1}</p>

                  {order.address.street2 && (
                    <p>{order.address.street2}</p>
                  )}

                  {order.address.landmark && (
                    <p>{order.address.landmark}</p>
                  )}

                  <p>
                    {order.address.city},{' '}
                    {order.address.state}
                  </p>

                  <p>
                    {order.address.postalCode},{' '}
                    {order.address.country}
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Information */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5">
                <CreditCardIcon className="h-5 w-5 text-green-600" />

                <h2 className="text-lg font-semibold text-gray-900">
                  Payment Information
                </h2>
              </div>

              <div className="space-y-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">
                    Payment method
                  </span>

                  <span className="font-medium text-gray-900">
                    {getPaymentMethodLabel(order.paymentMethod)}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">
                    Payment status
                  </span>

                  <span
                    className={`inline-flex px-2.5 py-1 rounded-full border text-xs font-semibold ${getPaymentStatusColor(
                      order.paymentStatus
                    )}`}
                  >
                    {order.paymentStatus}
                  </span>
                </div>

                {paymentLog?.razorpayOrderId && (
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">
                      Razorpay order
                    </span>

                    <span className="font-mono text-xs text-gray-700 break-all text-right">
                      {paymentLog.razorpayOrderId}
                    </span>
                  </div>
                )}

                {paymentLog?.razorpayPaymentId && (
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">
                      Payment ID
                    </span>

                    <span className="font-mono text-xs text-gray-700 break-all text-right">
                      {paymentLog.razorpayPaymentId}
                    </span>
                  </div>
                )}

                {paymentLog?.createdAt && (
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">
                      Payment initiated
                    </span>

                    <span className="text-gray-700 text-right">
                      {formatDateTime(paymentLog.createdAt)}
                    </span>
                  </div>
                )}
              </div>

              {order.paymentMethod?.toLowerCase() === 'cod' && (
                <div className="mt-5 rounded-lg bg-amber-50 border border-amber-200 p-4">
                  <p className="text-sm font-medium text-amber-900">
                    Cash on Delivery
                  </p>

                  <p className="text-sm text-amber-800 mt-1">
                    Please keep{' '}
                    <strong>
                      {formatCurrency(order.totalAmount)}
                    </strong>{' '}
                    ready when your order is delivered.
                  </p>
                </div>
              )}
            </div>

            {/* Cancellation Information */}
            {isCancelled && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <ExclamationCircleIcon className="h-6 w-6 text-red-600 flex-shrink-0" />

                  <div>
                    <h2 className="font-semibold text-red-900">
                      Order Cancelled
                    </h2>

                    {order.cancelReason && (
                      <p className="text-sm text-red-800 mt-1">
                        Reason: {order.cancelReason}
                      </p>
                    )}

                    {order.cancelledAt && (
                      <p className="text-xs text-red-700 mt-2">
                        Cancelled on{' '}
                        {formatDateTime(order.cancelledAt)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 lg:sticky lg:top-4">

              <h2 className="text-lg font-semibold text-gray-900 mb-6">
                Order Progress
              </h2>

              <div className="space-y-6">

                {/* Placed */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div
                      className={`h-9 w-9 rounded-full flex items-center justify-center ${
                        order.status !== 'PENDING'
                          ? 'bg-green-100'
                          : 'bg-amber-100'
                      }`}
                    >
                      {order.status !== 'PENDING' ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-600" />
                      ) : (
                        <ClockIcon className="h-5 w-5 text-amber-600" />
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-900">
                      Order Placed
                    </h3>

                    <p className="text-xs text-gray-500 mt-1">
                      Your order has been created successfully.
                    </p>
                  </div>
                </div>

                {/* Payment */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div
                      className={`h-9 w-9 rounded-full flex items-center justify-center ${
                        paymentPaid
                          ? 'bg-green-100'
                          : paymentFailed
                            ? 'bg-red-100'
                            : 'bg-amber-100'
                      }`}
                    >
                      {paymentPaid ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-600" />
                      ) : paymentFailed ? (
                        <ExclamationCircleIcon className="h-5 w-5 text-red-600" />
                      ) : (
                        <ClockIcon className="h-5 w-5 text-amber-600" />
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-900">
                      Payment
                    </h3>

                    <p className="text-xs text-gray-500 mt-1">
                      {paymentPaid
                        ? 'Payment has been confirmed.'
                        : paymentFailed
                          ? 'Payment was not completed.'
                          : 'Payment confirmation is pending.'}
                    </p>
                  </div>
                </div>

                {/* Processing */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div
                      className={`h-9 w-9 rounded-full flex items-center justify-center ${
                        ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(
                          order.status
                        )
                          ? 'bg-blue-100'
                          : 'bg-gray-100'
                      }`}
                    >
                      <ClockIcon
                        className={`h-5 w-5 ${
                          ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(
                            order.status
                          )
                            ? 'text-blue-600'
                            : 'text-gray-400'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-900">
                      Processing
                    </h3>

                    <p className="text-xs text-gray-500 mt-1">
                      Your items will be prepared for shipment.
                    </p>
                  </div>
                </div>

                {/* Shipped */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div
                      className={`h-9 w-9 rounded-full flex items-center justify-center ${
                        ['SHIPPED', 'DELIVERED'].includes(order.status)
                          ? 'bg-purple-100'
                          : 'bg-gray-100'
                      }`}
                    >
                      <TruckIcon
                        className={`h-5 w-5 ${
                          ['SHIPPED', 'DELIVERED'].includes(order.status)
                            ? 'text-purple-600'
                            : 'text-gray-400'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-900">
                      Shipped
                    </h3>

                    <p className="text-xs text-gray-500 mt-1">
                      {order.trackingNumber
                        ? `Tracking: ${order.trackingNumber}`
                        : 'Tracking information will appear here once shipped.'}
                    </p>
                  </div>
                </div>

                {/* Delivered */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div
                      className={`h-9 w-9 rounded-full flex items-center justify-center ${
                        order.status === 'DELIVERED'
                          ? 'bg-green-100'
                          : 'bg-gray-100'
                      }`}
                    >
                      <CheckCircleIcon
                        className={`h-5 w-5 ${
                          order.status === 'DELIVERED'
                            ? 'text-green-600'
                            : 'text-gray-400'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-900">
                      Delivered
                    </h3>

                    <p className="text-xs text-gray-500 mt-1">
                      {order.deliveredAt
                        ? `Delivered on ${formatDate(
                            order.deliveredAt
                          )}`
                        : 'Delivery confirmation will appear here.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-7 pt-6 border-t border-gray-100 space-y-3">

                {paymentPending && (
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition"
                  >
                    <ArrowPathIcon className="h-5 w-5" />
                    Refresh Payment Status
                  </button>
                )}

                <Link
                  href="/dashboard"
                  className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition text-center block"
                >
                  View My Orders
                </Link>

                <Link
                  href="/products"
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition text-center block"
                >
                  Continue Shopping
                </Link>
              </div>

              {/* Support */}
              <div className="mt-6 pt-6 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">
                  Need Help?
                </h3>

                <p className="text-xs text-gray-500 mt-1 mb-3">
                  If you have questions about your order or payment,
                  please contact support.
                </p>

                <Link
                  href="/contact"
                  className="text-sm text-green-600 hover:text-green-700 font-semibold"
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

export default function OrderSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto" />
            <p className="mt-4 text-sm text-gray-500">
              Loading your order...
            </p>
          </div>
        </div>
      }
    >
      <OrderSuccessContent />
    </Suspense>
  )
}
