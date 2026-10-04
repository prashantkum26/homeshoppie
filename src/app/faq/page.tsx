'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon, ChevronDownIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline'

interface FaqItem {
  question: string
  answer: string
  category: string
}

const faqs: FaqItem[] = [
  {
    category: 'Products & Purity',
    question: 'Are your Ghee and Oils 100% pure and unadulterated?',
    answer: 'Yes! All our ghee products are prepared using the authentic ancient Bilona churning method from grass-fed cow/buffalo milk. Our mustard oils are cold-pressed (Kachi Ghani) using wooden churners without any chemical refining or preservatives.'
  },
  {
    category: 'Products & Purity',
    question: 'How do you ensure traditional taste in items like Thekua and Gujiya?',
    answer: 'Our sweets are handmade in small artisan batches following traditional regional recipes from Bihar. We use organic jaggery, pure ghee, and unrefined wheat flour without adding artificial flavors or colors.'
  },
  {
    category: 'Shipping & Delivery',
    question: 'How long does shipping take across India?',
    answer: 'Orders are typically dispatched within 24 to 48 hours of placement. Standard delivery takes 3 to 6 business days depending on your delivery pin code and location.'
  },
  {
    category: 'Shipping & Delivery',
    question: 'Do you offer free shipping?',
    answer: 'Yes, we offer free standard shipping on all prepaid orders above ₹999 across India.'
  },
  {
    category: 'Orders & Payments',
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit/debit cards, UPI (Google Pay, PhonePe, Paytm), Net Banking, and Cash on Delivery (COD) for eligible pin codes.'
  },
  {
    category: 'Orders & Payments',
    question: 'Can I modify or cancel my order after placing it?',
    answer: 'You can cancel or modify your order within 2 hours of placement by contacting our support team or visiting your account orders page.'
  }
]

export default function FaqPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const [selectedCategory, setSelectedCategory] = useState<string>('All')

  const categories = ['All', 'Products & Purity', 'Shipping & Delivery', 'Orders & Payments']

  const filteredFaqs = selectedCategory === 'All' 
    ? faqs 
    : faqs.filter(f => f.category === selectedCategory)

  return (
    <main className="min-h-screen bg-[#faf9f5] text-slate-900 pb-20">
      
      {/* Hero Header */}
      <section className="relative overflow-hidden border-b border-stone-200/70 bg-white py-12 sm:py-16">
        <div className="absolute right-0 -top-32 h-80 w-80 rounded-full bg-purple-100/40 blur-3xl pointer-events-none" />

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
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-200/80 bg-purple-50 px-3 py-1">
              <QuestionMarkCircleIcon className="h-4 w-4 text-purple-700" />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-800">
                Help & Support Center
              </span>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
              Frequently Asked Questions
            </h1>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Got questions about our artisanal products, shipping policies, or payment methods? Find answers below.
            </p>
          </div>
        </div>
      </section>

      {/* Category Filter Pills */}
      <section className="mx-auto max-w-3xl px-4 pt-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                selectedCategory === cat
                  ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/20'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Accordion List */}
        <div className="space-y-4">
          {filteredFaqs.map((faq, index) => {
            const isOpen = openIndex === index
            return (
              <div
                key={index}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition-all duration-200"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full flex items-center justify-between p-5 text-left font-semibold text-slate-900 hover:text-primary-600 transition-colors cursor-pointer"
                >
                  <span className="text-sm sm:text-base pr-4">{faq.question}</span>
                  <ChevronDownIcon className={`h-5 w-5 text-slate-400 transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180 text-primary-600' : ''}`} />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-0 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4 mt-1">
                    {faq.answer}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Still have questions card */}
        <div className="mt-12 bg-white rounded-3xl border border-slate-200/80 p-8 text-center shadow-xs">
          <h3 className="text-base font-bold text-slate-900 mb-2">Still have questions?</h3>
          <p className="text-xs sm:text-sm text-slate-500 mb-6 max-w-md mx-auto">
            Can't find the answer you're looking for? Please reach out to our customer support team directly.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-slate-950 text-white font-semibold text-xs sm:text-sm transition hover:bg-slate-800 shadow-sm"
          >
            Get in Touch
          </Link>
        </div>
      </section>
    </main>
  )
}