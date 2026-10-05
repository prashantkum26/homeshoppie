'use client'

import { useState } from 'react'
import Link from 'next/link'
import { 
  TruckIcon, 
  MagnifyingGlassIcon, 
  // CheckCircleIcon, 
  ClockIcon, 
  // ShoppingBagIcon, 
  ArrowLeftIcon 
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface TrackingDetails {
  orderId: string
  status: 'Processing' | 'Dispatched' | 'Delivered'
  date: string
  courier: string
  trackingNumber: string
  items: { name: string; quantity: number; price: number }[]
  estimatedDelivery: string
}

export default function TrackOrderPage() {
  const [orderInput, setOrderInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [orderData, setOrderData] = useState<TrackingDetails | null>(null)

  const handleTrackOrder = (e: React.FormEvent) => {
    e.preventDefault()
    if (!orderInput.trim()) {
      toast.error('Please enter a valid order ID')
      return
    }

    setIsLoading(true)
    setOrderData(null)

    // Simulate API lookup delay
    setTimeout(() => {
      setIsLoading(false)
      // Mock data representation for demo
      if (orderInput.toLowerCase() === 'hs12345' || orderInput.length > 4) {
        setOrderData({
          orderId: orderInput.toUpperCase(),
          status: 'Dispatched',
          date: 'October 2, 2026',
          courier: 'Blue Dart Express',
          trackingNumber: 'BD-987654321IN',
          estimatedDelivery: 'October 6, 2026',
          items: [
            { name: 'Pure Buffalo Ghee (Bilona)', quantity: 1, price: 850 },
            { name: 'Traditional Thekua', quantity: 2, price: 300 }
          ]
        })
        toast.success('Order found!')
      } else {
        toast.error('Order not found. Please check your Order ID.')
      }
    }, 600)
  }

  return (
    <main className="min-h-screen bg-[#faf9f5] text-slate-900 pb-20">
      
      {/* Hero Header */}
      <section className="relative overflow-hidden border-b border-stone-200/70 bg-white py-12 sm:py-16">
        <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-amber-100/40 blur-3xl pointer-events-none" />
        
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-950 transition-colors uppercase tracking-wider"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              <span>Back to Home</span>
            </Link>
          </div>

          <div className="text-center max-w-xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50 px-3 py-1">
              <TruckIcon className="h-4 w-4 text-amber-700" />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-800">
                Live Shipment Tracking
              </span>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
              Track your order
            </h1>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Enter your Order ID and email address below to check the real-time shipping status and delivery updates.
            </p>
          </div>
        </div>
      </section>

      {/* Lookup Form Container */}
      <section className="mx-auto max-w-2xl px-4 pt-10 sm:px-6">
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-sm">
          <form onSubmit={handleTrackOrder} className="space-y-5">
            <div>
              <label htmlFor="orderId" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Order ID <span className="text-rose-500">*</span>
              </label>
              <input
                id="orderId"
                type="text"
                placeholder="e.g. HS12345"
                value={orderInput}
                onChange={(e) => setOrderInput(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all placeholder:text-slate-400"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Billing Email (Optional)
              </label>
              <input
                id="email"
                type="email"
                placeholder="e.g. prashant@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all placeholder:text-slate-400"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm shadow-md shadow-primary-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <MagnifyingGlassIcon className="h-4 w-4" />
                  <span>Track Order</span>
                </>
              )}
            </button>
          </form>

          {/* Results Display */}
          {orderData && (
            <div className="mt-10 pt-8 border-t border-slate-100 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Order ID</span>
                  <p className="text-base font-bold text-slate-900">{orderData.orderId}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Status</span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 mt-0.5">
                    <ClockIcon className="h-3.5 w-3.5" />
                    {orderData.status}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Est. Delivery</span>
                  <p className="text-sm font-semibold text-slate-800">{orderData.estimatedDelivery}</p>
                </div>
              </div>

              {/* Courier details */}
              <div className="text-xs text-slate-600 space-y-1 mb-6 bg-amber-50/50 p-4 rounded-xl border border-amber-200/40">
                <p><strong className="text-slate-800">Courier Partner:</strong> {orderData.courier}</p>
                <p><strong className="text-slate-800">Tracking Number:</strong> {orderData.trackingNumber}</p>
              </div>

              {/* Items Summary */}
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Order Items</h4>
              <div className="space-y-2">
                {orderData.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm py-2 border-b border-slate-100">
                    <span className="text-slate-700 font-medium">{item.name} × {item.quantity}</span>
                    <span className="text-slate-900 font-bold">₹{item.price * item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}