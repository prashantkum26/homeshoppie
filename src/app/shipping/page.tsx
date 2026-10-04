import Link from 'next/link'
import { ArrowLeftIcon, TruckIcon, ClockIcon, MapPinIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'

export default function ShippingPage() {
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

          <div className="text-center max-w-2xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50 px-3 py-1">
              <TruckIcon className="h-4 w-4 text-amber-700" />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-800">
                Delivery & Fulfillment
              </span>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
              Shipping & Delivery Policy
            </h1>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              We ensure fast, secure, and hygienic delivery of our artisanal products right to your doorstep across India.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content Body */}
      <section className="mx-auto max-w-3xl px-4 pt-12 sm:px-6 space-y-8">
        
        {/* Highlight Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex items-start gap-4">
            <div className="p-3 rounded-xl bg-amber-50 text-amber-700 shrink-0">
              <ClockIcon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Fast Dispatches</h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Orders are carefully packed and dispatched within 24–48 hours of confirmation.
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex items-start gap-4">
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 shrink-0">
              <ShieldCheckIcon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Secure Packaging</h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Tamper-proof, leak-resistant packaging designed specifically for glass jars and food items.
              </p>
            </div>
          </div>
        </div>

        {/* Detailed Sections */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-sm space-y-6 text-sm text-slate-600 leading-relaxed">
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">1. Delivery Timelines</h2>
            <p>
              Standard shipping typically takes between 3 to 6 business days depending on your location and pin code. Deliveries to remote or tier-3 locations may take an additional 2–3 business days. You will receive an SMS and email notification with live tracking details once your order ships.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">2. Shipping Charges</h2>
            <p>
              We offer free standard shipping across India on all prepaid orders above ₹999. For orders below ₹999, a nominal flat shipping fee of ₹99 is applied at checkout to cover courier costs.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">3. Courier Partners</h2>
            <p>
              We partner with top-tier national logistics providers including Blue Dart, Delhivery, and DTDC to ensure reliable and safe transit of your artisanal items.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">4. Order Tracking</h2>
            <p>
              You can track your package anytime by visiting our <Link href="/track-order" className="text-primary-600 font-semibold hover:underline">Track Order</Link> page and entering your Order ID.
            </p>
          </div>

          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 p-6 rounded-2xl">
            <div className="flex items-center gap-3">
              <MapPinIcon className="h-8 w-8 text-primary-600 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">Have delivery questions?</h4>
                <p className="text-xs text-slate-500">Reach out if your package is delayed or requires special handling.</p>
              </div>
            </div>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-slate-950 text-white font-semibold text-xs transition hover:bg-slate-800 shadow-sm"
            >
              Contact Support
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}