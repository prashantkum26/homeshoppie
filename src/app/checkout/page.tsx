'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'
import useCartStore from '@/store/cartStore'
import { loadScript } from '@/utils/loadScript'

interface Address {
  id?: string
  name: string
  phone: string
  street1: string
  street2?: string
  city: string
  state: string
  postalCode: string
  landmark?: string
  type: string
}

interface CheckoutForm {
  shippingAddress: Address
  billingAddress: Address
  sameAsShipping: boolean
  paymentMethod: string
  notes: string
}

export default function CheckoutPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { clearCart } = useCartStore();

  const [items, setItems] = useState<any[]>([])
  const [subtotal, setSubtotal] = useState(0)
  const [shippingFee, setShippingFee] = useState(0)
  const [taxAmount, setTaxAmount] = useState(0) // 👈 Added Tax state
  const [total, setTotal] = useState(0)
  const [itemCount, setItemCount] = useState(0)

  const [isLoading, setIsLoading] = useState(false)
  const [isProcessingError, setIsProcessingError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([])
  const [formData, setFormData] = useState<CheckoutForm>({
    shippingAddress: {
      name: '',
      phone: '',
      street1: '',
      street2: '',
      city: '',
      state: '',
      postalCode: '',
      landmark: '',
      type: 'HOME'
    },
    billingAddress: {
      name: '',
      phone: '',
      street1: '',
      street2: '',
      city: '',
      state: '',
      postalCode: '',
      landmark: '',
      type: 'HOME'
    },
    sameAsShipping: true,
    paymentMethod: 'card',
    notes: ''
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/checkout')
      return
    }

    fetchSavedAddresses()
  }, [status, router])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/checkout')
      return
    }

    if (status === 'authenticated') {
      fetchCheckoutData()
    }
  }, [status, router])

  const fetchSavedAddresses = async () => {
    try {
      const response = await fetch('/api/user/addresses')
      if (response.ok) {
        const addresses = await response.json()
        setSavedAddresses(addresses)

        if (addresses.length > 0) {
          const address = addresses[0]
          setFormData(prev => ({
            ...prev,
            shippingAddress: {
              id: address.id,
              name: address.name || '',
              phone: address.phone || '',
              street1: address.street1 || '',
              street2: address.street2 || '',
              city: address.city || '',
              state: address.state || '',
              postalCode: address.postalCode || '',
              landmark: address.landmark || '',
              type: address.type || 'HOME'
            }
          }))
        }
      }
    } catch (error) {
      console.error('Error fetching addresses:', error)
    }
  }

  const handleAddressChange = (type: 'shippingAddress' | 'billingAddress', field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value
      }
    }))
  }

  const handleSameAsShippingChange = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      sameAsShipping: checked,
      billingAddress: checked ? prev.shippingAddress : {
        name: '',
        phone: '',
        street1: '',
        street2: '',
        city: '',
        state: '',
        postalCode: '',
        landmark: '',
        type: 'HOME'
      }
    }))
  }

  const selectSavedAddress = (address: Address, type: 'shippingAddress' | 'billingAddress') => {
    setFormData(prev => ({
      ...prev,
      [type]: {
        id: address.id,
        name: address.name || '',
        phone: address.phone || '',
        street1: address.street1 || '',
        street2: address.street2 || '',
        city: address.city || '',
        state: address.state || '',
        postalCode: address.postalCode || '',
        landmark: address.landmark || '',
        type: address.type || 'HOME'
      }
    }))
  }

  const validateForm = () => {
    const { shippingAddress, billingAddress, sameAsShipping } = formData

    if (!shippingAddress.name || !shippingAddress.phone || !shippingAddress.street1 ||
      !shippingAddress.city || !shippingAddress.state || !shippingAddress.postalCode) {
      toast.error('Please fill in all required shipping address fields')
      return false
    }

    if (!sameAsShipping) {
      if (!billingAddress.name || !billingAddress.phone || !billingAddress.street1 ||
        !billingAddress.city || !billingAddress.state || !billingAddress.postalCode) {
        toast.error('Please fill in all required billing address fields')
        return false
      }
    }

    return true
  }

  const handlePaymentError = async (orderId: string, errorType: 'failed' | 'cancelled', _errorDetails?: any) => {
    setIsProcessingError(true)
    
    try {
      if (errorType === 'failed') {
        setErrorMessage('Payment failed. Saving your order...')
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        toast.error('Payment failed. You can retry payment from your orders page.')
        // Redirect directly to the specific order details page where they can retry
        router.push(`/orders/${orderId}?status=payment_failed`)
        
      } else if (errorType === 'cancelled') {
        setErrorMessage('Payment cancelled. Saving your order...')
        await new Promise(resolve => setTimeout(resolve, 800))
        
        toast('Payment was cancelled. Your order has been saved.')
        
        // 🚀 STANDARD UX: Take them out of checkout into the order details view
        router.push(`/orders/${orderId}?status=payment_cancelled`)
      }
    } catch (error) {
      console.error('Error during payment error handling:', error)
      toast.error(`Payment ${errorType}. Please check your orders page.`)
      router.push('/orders')
    } finally {
      setIsProcessingError(false)
      setErrorMessage('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsLoading(true)

    try {
      const addressesToSave = [formData.shippingAddress]
      if (!formData.sameAsShipping) {
        addressesToSave.push(formData.billingAddress)
      }

      for (const address of addressesToSave) {
        if (!address.id) {
          await fetch('/api/user/addresses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(address),
          })
        }
      }

      const orderData = {
        items: items.map(item => ({
          productId: item.id,
          quantity: item.quantity,
        })),
        shippingAddress: formData.shippingAddress,
        billingAddress: formData.sameAsShipping
          ? formData.shippingAddress
          : formData.billingAddress,
        paymentMethod: formData.paymentMethod,
        notes: formData.notes,
      };

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create order')
      }

      const internalOrder = await response.json();

      const ok = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
      if (!ok) {
        toast.error("Failed to load Razorpay");
        return;
      }

      const rzpOrderRes = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: internalOrder.id }),
      });

      if (!rzpOrderRes.ok) {
        router.push(`/orders?highlight=${internalOrder.id}&status=error`)

        return;
      }

      const rzpOrder = await rzpOrderRes.json();

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency || "INR",
        name: "HomeShoppie",
        description: `Payment for Order ${internalOrder.orderNumber}`,
        order_id: rzpOrder.id,
        retry: { enabled: false },
        handler: async function (response: any) {
          try {
            setIsProcessingError(true)
            setErrorMessage('Verifying payment...')

            const verifyRes = await fetch("/api/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              }),
            });

            const verified = await verifyRes.json();

            if (verified.success) {
              setErrorMessage('Payment successful! Redirecting...')
              await new Promise(resolve => setTimeout(resolve, 1000))
              
              clearCart()
              router.push(`/order-success?orderId=${verified.order_id}&orderNumber=${verified.order_number}`)
            } else {
              setIsProcessingError(false)
              setErrorMessage('')
              const errorMsg = verified.error || "Payment verification failed"
              toast.error(`${errorMsg}. Please contact support if amount was deducted.`)
              router.push(`/orders?highlight=${internalOrder.id}&status=verification_failed&payment_id=${response.razorpay_payment_id}`)
            }
          } catch (verifyError) {
            console.error('Payment verification error:', verifyError)
            setIsProcessingError(false)
            setErrorMessage('')
            toast.error("Network error during verification. Please check your orders page or contact support.")
            router.push(`/orders?highlight=${internalOrder.id}&status=verification_error&payment_id=${response.razorpay_payment_id}`)
          }
        },
        modal: {
          ondismiss: function() {
            toast.error("Payment cancelled. Your order is saved and you can complete payment later.");
            handlePaymentError(internalOrder.id, 'cancelled');
          }          
        },
        prefill: {
          name: formData.shippingAddress.name,
          email: session?.user?.email || "",
          contact: formData.shippingAddress.phone
        },
        notes: {
          order_id: internalOrder.id,
          order_number: internalOrder.orderNumber
        },
        theme: { 
          color: "#00A96E",
          backdrop_color: "rgba(0, 0, 0, 0.6)"
        },
        timeout: 300,
        remember_customer: false
      };

      const payment = new window.Razorpay({ ...options });
      
      payment.on('payment.failed', function (response: any) {
        // console.error('Payment failed:', response.error);

        // Close Razorpay Checkout modal immediately
        payment.close();

        toast.error(`Payment failed: ${response.error.description}`);
        handlePaymentError(internalOrder.id, 'failed', response.error);
      });

      payment.open();

    } catch (error: any) {
      toast.error(error.message || 'Failed to process checkout')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCheckoutData = async () => {
    try {
      setIsLoading(true)
      
      const [cartRes, addressRes] = await Promise.all([
        fetch('/api/cart/summary'),
        fetch('/api/user/addresses')
      ]);

      if (cartRes.ok) {
        const cartData = await cartRes.json()
        
        if (!cartData.items || cartData.items.length === 0) {
          toast.error('Your cart is empty')
          router.push('/cart')
          return
        }

        setItems(cartData.items)
        setSubtotal(Number(cartData.subtotal) || 0)
        setShippingFee(Number(cartData.shippingFee) || 0)
        setTaxAmount(Number(cartData.taxAmount) || 0) // 👈 Hydrating tax from summary API
        setTotal(Number(cartData.total) || 0)
        setItemCount(Number(cartData.itemCount) || 0)
      }

      if (addressRes.ok) {
        const addresses = await addressRes.json()
        setSavedAddresses(addresses)

        if (addresses.length > 0) {
          const address = addresses[0]
          setFormData(prev => ({
            ...prev,
            shippingAddress: {
              id: address.id,
              name: address.name || '',
              phone: address.phone || '',
              street1: address.street1 || '',
              street2: address.street2 || '',
              city: address.city || '',
              state: address.state || '',
              postalCode: address.postalCode || '',
              landmark: address.landmark || '',
              type: address.type || 'HOME'
            }
          }))
        }
      }
    } catch (error) {
      console.error('Error loading checkout data:', error)
      toast.error('Failed to load checkout details')
    } finally {
      setIsLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600"></div>
      </div>
    )
  }

  if (!session || items.length === 0) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {isProcessingError && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-lg max-w-sm w-full mx-4">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4"></div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Processing...</h3>
              <p className="text-sm text-gray-600 text-center">{errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* Shipping Address */}
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Shipping Address</h2>

                {savedAddresses.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Choose from saved addresses</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {savedAddresses.map((address) => (
                        <button
                          key={address.id}
                          type="button"
                          onClick={() => selectSavedAddress(address, 'shippingAddress')}
                          className="text-left p-3 border border-gray-200 rounded-md hover:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                          <div className="text-sm font-medium">{address.name}</div>
                          <div className="text-sm text-gray-600">{address.street1}{address.street2 ? `, ${address.street2}` : ''}, {address.city}</div>
                          <div className="text-sm text-gray-600">{address.state} - {address.postalCode}</div>
                        </button>
                      ))}
                    </div>
                    <hr className="my-6" />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.shippingAddress.name}
                      onChange={(e) => handleAddressChange('shippingAddress', 'name', e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      value={formData.shippingAddress.phone}
                      onChange={(e) => handleAddressChange('shippingAddress', 'phone', e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Street Address Line 1 *</label>
                    <input
                      type="text"
                      required
                      value={formData.shippingAddress.street1}
                      onChange={(e) => handleAddressChange('shippingAddress', 'street1', e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      placeholder="House number, building, apartment"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Street Address Line 2 (Optional)</label>
                    <input
                      type="text"
                      value={formData.shippingAddress.street2}
                      onChange={(e) => handleAddressChange('shippingAddress', 'street2', e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      placeholder="Area, locality, or additional info"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">City *</label>
                    <input
                      type="text"
                      required
                      value={formData.shippingAddress.city}
                      onChange={(e) => handleAddressChange('shippingAddress', 'city', e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">State *</label>
                    <input
                      type="text"
                      required
                      value={formData.shippingAddress.state}
                      onChange={(e) => handleAddressChange('shippingAddress', 'state', e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Postal Code *</label>
                    <input
                      type="text"
                      required
                      value={formData.shippingAddress.postalCode}
                      onChange={(e) => handleAddressChange('shippingAddress', 'postalCode', e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Landmark (Optional)</label>
                    <input
                      type="text"
                      value={formData.shippingAddress.landmark}
                      onChange={(e) => handleAddressChange('shippingAddress', 'landmark', e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>
              </div>

              {/* Billing Address */}
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Billing Address</h2>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.sameAsShipping}
                      onChange={(e) => handleSameAsShippingChange(e.target.checked)}
                      className="rounded border-gray-300 text-green-600 shadow-sm focus:border-green-300 focus:ring focus:ring-green-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-sm text-gray-700">Same as shipping address</span>
                  </label>
                </div>

                {!formData.sameAsShipping && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.billingAddress.name}
                        onChange={(e) => handleAddressChange('billingAddress', 'name', e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone Number *</label>
                      <input
                        type="tel"
                        required
                        value={formData.billingAddress.phone}
                        onChange={(e) => handleAddressChange('billingAddress', 'phone', e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Street Address Line 1 *</label>
                      <input
                        type="text"
                        required
                        value={formData.billingAddress.street1}
                        onChange={(e) => handleAddressChange('billingAddress', 'street1', e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                        placeholder="House number, building, apartment"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Street Address Line 2 (Optional)</label>
                      <input
                        type="text"
                        value={formData.billingAddress.street2}
                        onChange={(e) => handleAddressChange('billingAddress', 'street2', e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                        placeholder="Area, locality, or additional info"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">City *</label>
                      <input
                        type="text"
                        required
                        value={formData.billingAddress.city}
                        onChange={(e) => handleAddressChange('billingAddress', 'city', e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">State *</label>
                      <input
                        type="text"
                        required
                        value={formData.billingAddress.state}
                        onChange={(e) => handleAddressChange('billingAddress', 'state', e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Postal Code *</label>
                      <input
                        type="text"
                        required
                        value={formData.billingAddress.postalCode}
                        onChange={(e) => handleAddressChange('billingAddress', 'postalCode', e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Landmark (Optional)</label>
                      <input
                        type="text"
                        value={formData.billingAddress.landmark}
                        onChange={(e) => handleAddressChange('billingAddress', 'landmark', e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Method */}
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Method</h2>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="card"
                      checked={formData.paymentMethod === 'card'}
                      onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                      className="border-gray-300 text-green-600 shadow-sm focus:border-green-300 focus:ring focus:ring-green-200 focus:ring-opacity-50"
                    />
                    <span className="ml-3">Credit/Debit Card</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="upi"
                      checked={formData.paymentMethod === 'upi'}
                      onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                      className="border-gray-300 text-green-600 shadow-sm focus:border-green-300 focus:ring focus:ring-green-200 focus:ring-opacity-50"
                    />
                    <span className="ml-3">UPI Payment</span>
                  </label>
                </div>
              </div>

              {/* Order Notes */}
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Notes (Optional)</h2>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Special instructions for delivery..."
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>

            {/* Right Column - Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-lg shadow-sm sticky top-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Summary</h2>

                {/* Items */}
                <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-1">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center space-x-3">
                      <div className="flex-shrink-0 w-12 h-12 bg-gray-200 rounded overflow-hidden">
                        {item.images && item.images.length > 0 ? (
                          <Image
                            src={item.images[0]}
                            alt={item.name}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate">{item.name}</h3>
                        <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                      </div>

                      <div className="text-sm font-medium text-gray-900">
                        ₹{(item.total ?? (item.price * item.quantity)).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal ({itemCount} items)</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span>Shipping</span>
                    <span className={shippingFee === 0 ? 'text-green-600' : ''}>
                      {shippingFee === 0 ? 'FREE' : `₹${shippingFee.toFixed(2)}`}
                    </span>
                  </div>

                  {/* Tax Amount Line */}
                  <div className="flex justify-between text-sm">
                    <span>Tax</span>
                    <span>₹{taxAmount.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                    <span>Total</span>
                    <span>₹{total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 space-y-3">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-green-600 border border-transparent rounded-md shadow-sm py-3 px-4 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Processing...' : 'Continue to Payment'}
                  </button>

                  <Link
                    href="/cart"
                    className="w-full bg-white border border-gray-300 rounded-md shadow-sm py-3 px-4 text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 text-center block"
                  >
                    Back to Cart
                  </Link>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}