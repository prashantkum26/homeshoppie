import Link from 'next/link'
import { ArrowLeftIcon, ArrowPathRoundedSquareIcon, ShieldCheckIcon, ClockIcon, LifebuoyIcon } from '@heroicons/react/24/outline'

export default function ReturnsPage() {
  return (
    <main className="min-h-screen bg-[#faf9f5] text-slate-900 pb-20">
      
      {/* Hero Header */}
      <section className="relative overflow-hidden border-b border-stone-200/70 bg-white py-12 sm:py-16">
        <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-emerald-100/40 blur-3xl pointer-events-none" />

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
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1">
              <ArrowPathRoundedSquareIcon className="h-4 w-4 text-emerald-700" />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-800">
                Customer Assurance
              </span>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
              Returns & Refunds Policy
            </h1>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              We take pride in the purity and artisanal quality of our products. Read our policy regarding returns, replacements, and refunds.
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
              <h3 className="text-base font-bold text-slate-900 mb-1">7-Day Return Window</h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Eligible items can be raised for return or replacement within 7 days of successful delivery.
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex items-start gap-4">
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 shrink-0">
              <ShieldCheckIcon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 mb-1">100% Quality Guarantee</h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Received a damaged, leaked, or incorrect item? We offer instant free replacements or full refunds.
              </p>
            </div>
          </div>
        </div>

        {/* Detailed Sections */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-sm space-y-6 text-sm text-slate-600 leading-relaxed">
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">1. Eligibility for Returns</h2>
            <p>
              Due to the perishable and consumable nature of certain artisanal goods (such as pure ghee, oils, and traditional sweets), items must be unopened, in their original packaging, and accompanied by the receipt or proof of purchase. Opened food items cannot be returned unless found spoiled or defective upon delivery.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">2. Damaged or Defective Shipments</h2>
            <p>
              If your package arrived damaged or tampered with, please take photographs of the box and product immediately and contact our support team within 48 hours of delivery. We will arrange a priority pickup and replacement at no extra charge.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">3. Refund Processing Time</h2>
            <p>
              Once your returned item is received and inspected at our fulfillment hub, your refund will be processed. Credit will be automatically applied to your original method of payment within 5 to 7 business days.
            </p>
          </div>

          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 p-6 rounded-2xl">
            <div className="flex items-center gap-3">
              <LifebuoyIcon className="h-8 w-8 text-primary-600 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">Need help with a return?</h4>
                <p className="text-xs text-slate-500">Our support desk is available Monday to Saturday.</p>
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