'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

// Types based on Prisma Schema
type PaymentStatus = 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED'
type RefundStatus = 'NOT_REQUIRED' | 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED'

interface PaymentLog {
  id: string
  orderId: string
  razorpayOrderId: string | null
  razorpayPaymentId: string | null
  amount: number // Stored in paise/cents
  currency: string
  status: PaymentStatus
  method: string | null
  gateway: string
  failureReason: string | null
  failureCode: string | null
  reconciledAt: string | null
  refundStatus: RefundStatus
  refundId: string | null
  refundAmount: number | null
  refundFailureReason: string | null
  refundRequestedAt: string | null
  refundCompletedAt: string | null
  createdAt: string
  order: {
    orderNumber: string
    user: {
      name: string | null
      email: string
    }
  }
}

export default function PaymentsManagementPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  
  const [payments, setPayments] = useState<PaymentLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Slide-over state
  const [selectedPayment, setSelectedPayment] = useState<PaymentLog | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') router.push('/auth/signin')
    if (sessionStatus === 'authenticated') {
      if (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPER_ADMIN') {
        toast.error('Access denied.')
        router.push('/dashboard')
        return
      }
      fetchPayments()
    }
  }, [sessionStatus, router, session])

  const fetchPayments = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/admin/payments')
      if (!response.ok) throw new Error('Failed to fetch payments')
      setPayments(await response.json())
    } catch (error) {
      toast.error('Could not load payments')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateStatus = async (
    newStatus: PaymentStatus | null,
    isReconciling: boolean = false
  ) => {
    if (!selectedPayment) return

    try {
      setIsUpdating(true)
      const response = await fetch(`/api/admin/payments/${selectedPayment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          newStatus ? { status: newStatus, reconciled: isReconciling } : { reconciled: isReconciling }
        )
      })

      const updatedData = await response.json()

      if (!response.ok) {
        toast.error(updatedData?.error || 'Failed to update payment')
        return
      }

      toast.success(isReconciling ? 'Payment reconciled successfully' : 'Payment status updated')
      await fetchPayments()
      setSelectedPayment(updatedData)
    } catch (error) {
      toast.error('Failed to update payment')
    } finally {
      setIsUpdating(false)
    }
  }

  // Filter Logic
  const filteredPayments = payments.filter(p => {
    const matchesSearch = 
      p.razorpayPaymentId?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.order.user.email.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus =
      statusFilter === 'ALL' ||
      p.status === statusFilter ||
      (statusFilter === 'REFUND_PENDING' && ['PENDING', 'PROCESSING'].includes(p.refundStatus)) ||
      (statusFilter === 'REFUND_FAILED' && p.refundStatus === 'FAILED')

    return matchesSearch && matchesStatus
  })

  // Format currency (convert paise to rupees)
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
    }).format(amount / 100)
  }

  // UI Helpers
  const getStatusBadge = (status: PaymentStatus) => {
    const styles = {
      PAID: 'bg-green-100 text-green-800 border-green-200',
      AUTHORIZED: 'bg-blue-100 text-blue-800 border-blue-200',
      PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      FAILED: 'bg-red-100 text-red-800 border-red-200',
      CANCELLED: 'bg-gray-100 text-gray-800 border-gray-200',
      REFUNDED: 'bg-orange-100 text-orange-800 border-orange-200',
      PARTIALLY_REFUNDED: 'bg-orange-50 text-orange-600 border-orange-200',
    }
    return styles[status] || 'bg-gray-100 text-gray-800'
  }

  if (sessionStatus === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="sm:flex sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payments & Refunds</h1>
            <p className="mt-2 text-sm text-gray-700">Monitor Razorpay transactions, handle failures, and log manual refunds.</p>
          </div>
          <div className="mt-4 sm:mt-0 flex gap-4">
            <Link href="/admin" className="text-sm font-medium text-red-600 hover:text-red-500 my-auto">
              &larr; Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex flex-col sm:flex-row gap-4 border border-gray-200">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by Payment ID, Order #, or Email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
            />
          </div>
          <div className="sm:w-64">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
            >
              <option value="ALL">All Payment Statuses</option>
              <option value="PAID">Paid / Successful</option>
              <option value="FAILED">Failed Transactions</option>
              <option value="REFUNDED">Refunded</option>
              <option value="PENDING">Pending / Processing</option>
              <option value="REFUND_PENDING">Refund Required / Processing</option>
              <option value="REFUND_FAILED">Refund Failed</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction Info</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order & Customer</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Reconciled</th>
                  <th className="relative px-6 py-3"><span className="sr-only">View</span></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                      No transactions found.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((payment) => (
                    <tr 
                      key={payment.id} 
                      onClick={() => setSelectedPayment(payment)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{payment.gateway.toUpperCase()}</div>
                        <div className="text-xs text-gray-500 font-mono mt-1" title={payment.razorpayPaymentId || 'N/A'}>
                          {payment.razorpayPaymentId ? `${payment.razorpayPaymentId.slice(0, 15)}...` : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-gray-900">#{payment.order.orderNumber}</div>
                        <div className="text-xs text-gray-500">{payment.order.user.email}</div>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">{formatCurrency(payment.amount, payment.currency)}</div>
                        <div className="text-xs text-gray-500 capitalize">{payment.method || 'Unknown'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${getStatusBadge(payment.status)}`}>
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {payment.reconciledAt ? (
                          <span className="text-green-600 text-lg" title="Reconciled">✓</span>
                        ) : (
                          <span className="text-gray-300 text-lg" title="Pending Reconciliation">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium">
                        <button className="text-red-600 hover:text-red-900">Details</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Slide-over Detail Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 overflow-hidden z-50">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setSelectedPayment(null)} />
            <div className="fixed inset-y-0 right-0 pl-10 max-w-lg w-full flex">
              <div className="w-full h-full flex flex-col bg-white shadow-xl">
                
                {/* Modal Header */}
                <div className="px-6 py-6 bg-gray-50 border-b border-gray-200 flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Transaction Details</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(selectedPayment.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button onClick={() => setSelectedPayment(null)} className="text-gray-400 hover:text-gray-500">
                    <span className="text-2xl">&times;</span>
                  </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
                  
                  {/* Status Banner */}
                  <div className={`p-4 rounded-md border ${getStatusBadge(selectedPayment.status)} flex justify-between items-center`}>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide opacity-75 mb-1">Current Status</p>
                      <p className="text-lg font-bold">{selectedPayment.status}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold uppercase tracking-wide opacity-75 mb-1">Total Amount</p>
                      <p className="text-xl font-bold">{formatCurrency(selectedPayment.amount, selectedPayment.currency)}</p>
                    </div>
                  </div>

                  {/* Gateway Details */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide border-b pb-2">Gateway Information</h3>
                    <div className="space-y-3 text-sm">
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-gray-500">Gateway:</span>
                        <span className="col-span-2 font-medium capitalize">{selectedPayment.gateway}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-gray-500">Method:</span>
                        <span className="col-span-2 font-medium capitalize">{selectedPayment.method || 'Not recorded'}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-gray-500">Gateway Order ID:</span>
                        <span className="col-span-2 font-mono bg-gray-50 p-1 rounded border break-all">{selectedPayment.razorpayOrderId || 'N/A'}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-gray-500">Gateway Payment ID:</span>
                        <span className="col-span-2 font-mono bg-gray-50 p-1 rounded border break-all">{selectedPayment.razorpayPaymentId || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Order Link */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide border-b pb-2">Related Order</h3>
                    <div className="bg-gray-50 border rounded-md p-4 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-gray-900">Order #{selectedPayment.order.orderNumber}</p>
                        <p className="text-sm text-gray-500">{selectedPayment.order.user.name || selectedPayment.order.user.email}</p>
                      </div>
                    </div>
                  </div>

                  {selectedPayment.refundStatus !== 'NOT_REQUIRED' && (
                    <div className="bg-orange-50 border border-orange-200 rounded-md p-4">
                      <h3 className="text-sm font-semibold text-orange-900 mb-2">Refund Reconciliation</h3>
                      <p className="text-sm text-orange-800"><strong>Status:</strong> {selectedPayment.refundStatus}</p>
                      {selectedPayment.refundAmount !== null && (
                        <p className="text-sm text-orange-800 mt-1">
                          <strong>Amount:</strong> {formatCurrency(selectedPayment.refundAmount, selectedPayment.currency)}
                        </p>
                      )}
                      {selectedPayment.refundId && (
                        <p className="text-sm text-orange-800 mt-1 break-all"><strong>Refund ID:</strong> {selectedPayment.refundId}</p>
                      )}
                      {selectedPayment.refundFailureReason && (
                        <p className="text-sm text-red-700 mt-1"><strong>Failure:</strong> {selectedPayment.refundFailureReason}</p>
                      )}
                    </div>
                  )}

                  {/* Error Data (If Failed) */}
                  {selectedPayment.status === 'FAILED' && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-4">
                      <h3 className="text-sm font-semibold text-red-900 mb-2">Failure Details</h3>
                      <p className="text-sm text-red-700"><strong>Code:</strong> {selectedPayment.failureCode || 'Unknown'}</p>
                      <p className="text-sm text-red-700 mt-1"><strong>Reason:</strong> {selectedPayment.failureReason || 'No reason provided by gateway'}</p>
                    </div>
                  )}

                  {/* Admin Actions */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide border-b pb-2">Manual Actions</h3>
                    
                    <div className="space-y-3">
                      {!selectedPayment.reconciledAt && (
                        <button 
                          disabled={isUpdating}
                          onClick={() => handleUpdateStatus(null, true)}
                          className="w-full bg-blue-50 text-blue-700 border border-blue-200 py-2 rounded-md text-sm font-medium hover:bg-blue-100 transition disabled:opacity-50"
                        >
                          Mark as Reconciled (Settled in Bank)
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-3 italic text-center">
                      Paid, authorized and refund states are set only by verified Razorpay
                      webhooks and the refund worker. Issue refunds from the Razorpay
                      dashboard or let the automatic late-payment refund complete; they
                      cannot be set by hand here.
                    </p>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}