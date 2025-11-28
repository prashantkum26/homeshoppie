'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { CreditCardIcon, DevicePhoneMobileIcon, BanknotesIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

interface Order {
  id: string
  orderNumber: string
  totalAmount: number
  paymentMethod: string
  paymentStatus: string
  status: string
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

interface PaymentForm {
  cardNumber: string
  expiryDate: string
  cvv: string
  cardholderName: string
  upiId: string
}

export default function PaymentPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = searchParams.get('orderId')

  const [order, setOrder] = useState<Order | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardholderName: '',
    upiId: ''
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (!orderId) {
      router.push('/cart')
      toast.error('No order found')
      return
    }

    fetchOrder()
  }, [status, orderId, router])

  const fetchOrder = async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}`)
      
      if (response.ok) {
        const orderData = await response.json()
        setOrder(orderData)
      } else {
        toast.error('Order not found')
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Error fetching order:', error)
      toast.error('Failed to load order')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePaymentFormChange = (field: keyof PaymentForm, value: string) => {
    setPaymentForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    const matches = v.match(/\d{4,16}/g)
    const match = matches && matches[0] || ''
    const parts = []

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4))
    }

    if (parts.length) {
      return parts.join(' ')
    } else {
      return v
    }
  }

  const formatExpiryDate = (value: string) => {
    const v = value.replace(/\D/g, '')
    if (v.length >= 2) {
      return `${v.slice(0, 2)}/${v.slice(2, 4)}`
    }
    return v
  }

  const validateCardPayment = () => {
    const { cardNumber, expiryDate, cvv, cardholderName } = paymentForm
    
    if (!cardNumber || cardNumber.replace(/\s/g, '').length < 16) {
      toast.error('Please enter a valid card number')
      return false
    }
    
    if (!expiryDate || expiryDate.length < 5) {
      toast.error('Please enter a valid expiry date')
      return false
    }
    
    if (!cvv || cvv.length < 3) {
      toast.error('Please enter a valid CVV')
      return false
    }
    
    if (!cardholderName.trim()) {
      toast.error('Please enter cardholder name')
      return false
    }
    
    return true
  }

  const validateUPIPayment = () => {
    const { upiId } = paymentForm
    
    if (!upiId || !upiId.includes('@')) {
      toast.error('Please enter a valid UPI ID')
      return false
    }
    
    return true
  }

  const processPayment = async () => {
    if (!order) return

    setIsProcessing(true)

    try {
      // Validate payment details based on method
      if (order.paymentMethod === 'card' && !validateCardPayment()) {
        setIsProcessing(false)
        return
      }
      
      if (order.paymentMethod === 'upi' && !validateUPIPayment()) {
        setIsProcessing(false)
        return
      }

      // Simulate payment processing (replace with actual payment gateway integration)
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Update order payment status
      const response = await fetch(`/api/orders/${orderId}/payment`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentStatus: 'PAID',
          status: 'CONFIRMED',
          paymentDetails: order.paymentMethod === 'card' ? {
            last4: paymentForm.cardNumber.slice(-4),
            cardType: 'VISA' // This would be determined by the card number
          } : order.paymentMethod === 'upi' ? {
            upiId: paymentForm.upiId
          } : {}
        }),
      })

      if (!response.ok) {
        throw new Error('Payment processing failed')
      }

      toast.success('Payment successful!')
      router.push(`/order-success?orderId=${orderId}`)

    } catch (error: any) {
      toast.error(error.message || 'Payment failed. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600"></div>
      </div>
    )
  }

  if (!session || !order) {
    return null
  }

  // If order is COD or already paid, redirect
  if (order.paymentMethod === 'cod') {
    router.push(`/order-success?orderId=${orderId}`)
    return null
  }

  if (order.paymentStatus === 'PAID') {
    router.push(`/order-success?orderId=${orderId}`)
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Complete Payment</h1>
          <p className="mt-2 text-gray-600">Order #{order.orderNumber}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Payment Form */}
          <div className="lg:col-span-2">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              {/* Payment Method Display */}
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Method</h2>
                <div className="flex items-center p-3 border border-green-500 rounded-md bg-green-50">
                  {order.paymentMethod === 'card' && <CreditCardIcon className="h-5 w-5 text-green-600 mr-3" />}
                  {order.paymentMethod === 'upi' && <DevicePhoneMobileIcon className="h-5 w-5 text-green-600 mr-3" />}
                  {order.paymentMethod === 'cod' && <BanknotesIcon className="h-5 w-5 text-green-600 mr-3" />}
                  <span className="text-gray-900 font-medium">
                    {order.paymentMethod === 'card' && 'Credit/Debit Card'}
                    {order.paymentMethod === 'upi' && 'UPI Payment'}
                    {order.paymentMethod === 'cod' && 'Cash on Delivery'}
                  </span>
                </div>
              </div>

              {/* Card Payment Form */}
              {order.paymentMethod === 'card' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Cardholder Name</label>
                    <input
                      type="text"
                      value={paymentForm.cardholderName}
                      onChange={(e) => handlePaymentFormChange('cardholderName', e.target.value)}
                      placeholder="Enter cardholder name"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Card Number</label>
                    <input
                      type="text"
                      value={paymentForm.cardNumber}
                      onChange={(e) => handlePaymentFormChange('cardNumber', formatCardNumber(e.target.value))}
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Expiry Date</label>
                      <input
                        type="text"
                        value={paymentForm.expiryDate}
                        onChange={(e) => handlePaymentFormChange('expiryDate', formatExpiryDate(e.target.value))}
                        placeholder="MM/YY"
                        maxLength={5}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">CVV</label>
                      <input
                        type="text"
                        value={paymentForm.cvv}
                        onChange={(e) => handlePaymentFormChange('cvv', e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="123"
                        maxLength={4}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* UPI Payment Form */}
              {order.paymentMethod === 'upi' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">UPI ID</label>
                  <input
                    type="text"
                    value={paymentForm.upiId}
                    onChange={(e) => handlePaymentFormChange('upiId', e.target.value)}
                    placeholder="yourname@upi"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Enter your UPI ID (e.g., user@paytm, user@gpay, user@phonepe)
                  </p>
                </div>
              )}

              {/* Security Notice */}
              <div className="mt-6 p-4 bg-blue-50 rounded-md">
                <div className="flex">
                  <CheckCircleIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
                  <div>
                    <h3 className="text-sm font-medium text-blue-800">Secure Payment</h3>
                    <p className="mt-1 text-sm text-blue-700">
                      Your payment information is encrypted and secure. We do not store your card details.
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Button */}
              <div className="mt-6">
                <button
                  onClick={processPayment}
                  disabled={isProcessing}
                  className="w-full bg-green-600 border border-transparent rounded-md shadow-sm py-3 px-4 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing Payment...
                    </div>
                  ) : (
                    `Pay ₹${order.totalAmount.toFixed(2)}`
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-lg shadow-sm sticky top-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Summary</h2>
              
              {/* Items */}
              <div className="space-y-3 mb-6">
                {order.orderItems.map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-900">{item.name}</h3>
                      <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Total */}
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>₹{order.totalAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Delivery Address */}
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Delivery Address</h3>
                <div className="text-sm text-gray-600">
                  <p className="font-medium">{order.address.name}</p>
                  <p>{order.address.street}</p>
                  <p>{order.address.city}, {order.address.state}</p>
                  <p>{order.address.pincode}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
