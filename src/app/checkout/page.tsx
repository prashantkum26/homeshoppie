'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'
import useCartStore from '@/store/cartStore'

interface Address {
  id?: string
  name: string
  phone: string
  street: string
  city: string
  state: string
  pincode: string
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
  const { items, getTotal, getTotalItems, clearCart } = useCartStore()
  const [isLoading, setIsLoading] = useState(false)
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([])
  const [formData, setFormData] = useState<CheckoutForm>({
    shippingAddress: {
      name: '',
      phone: '',
      street: '',
      city: '',
      state: '',
      pincode: '',
      landmark: '',
      type: 'HOME'
    },
    billingAddress: {
      name: '',
      phone: '',
      street: '',
      city: '',
      state: '',
      pincode: '',
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

    if (items.length === 0) {
      router.push('/cart')
      toast.error('Your cart is empty')
      return
    }

    fetchSavedAddresses()
  }, [status, items.length, router])

  const fetchSavedAddresses = async () => {
    try {
      const response = await fetch('/api/user/addresses')
      if (response.ok) {
        const addresses = await response.json()
        setSavedAddresses(addresses)
        
        // If user has saved addresses, use the first one as default
        if (addresses.length > 0) {
          setFormData(prev => ({
            ...prev,
            shippingAddress: addresses[0]
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
        street: '',
        city: '',
        state: '',
        pincode: '',
        landmark: '',
        type: 'HOME'
      }
    }))
  }

  const selectSavedAddress = (address: Address, type: 'shippingAddress' | 'billingAddress') => {
    setFormData(prev => ({
      ...prev,
      [type]: address
    }))
  }

  const validateForm = () => {
    const { shippingAddress, billingAddress, sameAsShipping } = formData
    
    // Validate shipping address
    if (!shippingAddress.name || !shippingAddress.phone || !shippingAddress.street || 
        !shippingAddress.city || !shippingAddress.state || !shippingAddress.pincode) {
      toast.error('Please fill in all required shipping address fields')
      return false
    }

    // Validate billing address if different from shipping
    if (!sameAsShipping) {
      if (!billingAddress.name || !billingAddress.phone || !billingAddress.street || 
          !billingAddress.city || !billingAddress.state || !billingAddress.pincode) {
        toast.error('Please fill in all required billing address fields')
        return false
      }
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setIsLoading(true)

    try {
      // Save addresses if they're new
      const addressesToSave = [formData.shippingAddress]
      if (!formData.sameAsShipping) {
        addressesToSave.push(formData.billingAddress)
      }

      for (const address of addressesToSave) {
        if (!address.id) {
          await fetch('/api/user/addresses', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(address),
          })
        }
      }

      // Create order
      const orderData = {
        items: items.map(item => ({
          productId: item.id,
          quantity: item.quantity,
          price: item.price,
          name: item.name
        })),
        shippingAddress: formData.shippingAddress,
        billingAddress: formData.sameAsShipping ? formData.shippingAddress : formData.billingAddress,
        paymentMethod: formData.paymentMethod,
        notes: formData.notes,
        totalAmount: subtotal + shippingFee
      }

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create order')
      }

      const order = await response.json()
      
      // Redirect to payment page
      router.push(`/payment?orderId=${order.id}`)

    } catch (error: any) {
      toast.error(error.message || 'Failed to process checkout')
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

  const subtotal = getTotal()
  const shippingFee = subtotal > 500 ? 0 : 50
  const total = subtotal + shippingFee

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>
          
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Forms */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Shipping Address */}
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Shipping Address</h2>
                
                {/* Saved Addresses */}
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
                          <div className="text-sm text-gray-600">{address.street}, {address.city}</div>
                          <div className="text-sm text-gray-600">{address.state} - {address.pincode}</div>
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
                    <label className="block text-sm font-medium text-gray-700">Street Address *</label>
                    <input
                      type="text"
                      required
                      value={formData.shippingAddress.street}
                      onChange={(e) => handleAddressChange('shippingAddress', 'street', e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
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
                    <label className="block text-sm font-medium text-gray-700">PIN Code *</label>
                    <input
                      type="text"
                      required
                      value={formData.shippingAddress.pincode}
                      onChange={(e) => handleAddressChange('shippingAddress', 'pincode', e.target.value)}
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
                      <label className="block text-sm font-medium text-gray-700">Street Address *</label>
                      <input
                        type="text"
                        required
                        value={formData.billingAddress.street}
                        onChange={(e) => handleAddressChange('billingAddress', 'street', e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
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
                      <label className="block text-sm font-medium text-gray-700">PIN Code *</label>
                      <input
                        type="text"
                        required
                        value={formData.billingAddress.pincode}
                        onChange={(e) => handleAddressChange('billingAddress', 'pincode', e.target.value)}
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
                  
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cod"
                      checked={formData.paymentMethod === 'cod'}
                      onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                      className="border-gray-300 text-green-600 shadow-sm focus:border-green-300 focus:ring focus:ring-green-200 focus:ring-opacity-50"
                    />
                    <span className="ml-3">Cash on Delivery</span>
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
                <div className="space-y-3 mb-6">
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
                        ₹{(item.price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Totals */}
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal ({getTotalItems()} items)</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span>Shipping</span>
                    <span className={shippingFee === 0 ? 'text-green-600' : ''}>
                      {shippingFee === 0 ? 'FREE' : `₹${shippingFee.toFixed(2)}`}
                    </span>
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
