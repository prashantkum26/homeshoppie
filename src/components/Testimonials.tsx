'use client'

import { useState } from 'react'
import {
  StarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckBadgeIcon,
} from '@heroicons/react/24/solid'

interface Testimonial {
  id: number
  name: string
  location: string
  rating: number
  comment: string
  product: string
  image: string
}

interface TestimonialCardProps {
  testimonial: Testimonial
}

const testimonials: Testimonial[] = [
  {
    id: 1,
    name: 'Priya Sharma',
    location: 'Delhi',
    rating: 5,
    comment:
      'The cow ghee is absolutely pure and authentic! You can taste the difference. My family loves it and we order regularly.',
    product: 'Pure Cow Ghee',
    image: '/avatar.svg',
  },
  {
    id: 2,
    name: 'Rajesh Kumar',
    location: 'Mumbai',
    rating: 5,
    comment:
      'Best mustard oil I have ever used. Cold-pressed and completely natural. Great for cooking and health benefits.',
    product: 'Mustard Oil',
    image: '/avatar.svg',
  },
  {
    id: 3,
    name: 'Sunita Devi',
    location: 'Patna',
    rating: 5,
    comment:
      'The thekua tastes exactly like my grandmother used to make. So fresh and authentic. Perfect for festivals!',
    product: 'Traditional Thekua',
    image: '/avatar.svg',
  },
  {
    id: 4,
    name: 'Amit Gupta',
    location: 'Bangalore',
    rating: 5,
    comment:
      'Amazing quality namkeen! Fresh, crispy and full of flavor. Great packaging and quick delivery too.',
    product: 'Mixed Namkeen',
    image: '/avatar.svg',
  },
  {
    id: 5,
    name: 'Kavita Singh',
    location: 'Kolkata',
    rating: 5,
    comment:
      'The pooja items are of excellent quality. Brass diyas are beautifully crafted and the service is outstanding.',
    product: 'Brass Diya Set',
    image: '/avatar.svg',
  },
  {
    id: 6,
    name: 'Deepak Yadav',
    location: 'Lucknow',
    rating: 5,
    comment:
      'Buffalo ghee bilona method is superb! Rich taste and aroma. HomeShoppie never disappoints with quality.',
    product: 'Buffalo Ghee',
    image: '/avatar.svg',
  },
]

function Stars({ rating }: { rating: number }) {
  return (
    <div
      className="flex items-center gap-0.5"
      aria-label={`${rating} out of 5 stars`}
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <StarIcon
          key={index}
          className={`h-4 w-4 ${
            index < rating ? 'text-amber-400' : 'text-slate-200'
          }`}
        />
      ))}
    </div>
  )
}

function TestimonialCard({ testimonial }: TestimonialCardProps) {
  return (
    <article className="flex h-full min-h-[320px] flex-col rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-all duration-200 hover:border-slate-300 hover:shadow-[0_8px_24px_rgba(15,23,42,0.07)]">
      {/* Customer */}
      <div className="flex items-center gap-3">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
          <img
            src={testimonial.image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />

          {/* <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-slate-600">
            {testimonial.name.charAt(0)}
          </span> */}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold text-slate-900">
              {testimonial.name}
            </h3>

            <CheckBadgeIcon
              className="h-4 w-4 shrink-0 text-primary-500"
              aria-label="Verified purchase"
            />
          </div>

          <p className="mt-0.5 text-xs text-slate-500">
            {testimonial.location}
          </p>
        </div>
      </div>

      {/* Rating */}
      <div className="mt-5">
        <Stars rating={testimonial.rating} />
      </div>

      {/* Review */}
      <div className="mt-4 flex-1">
        <p className="text-[15px] leading-7 text-slate-600">
          “{testimonial.comment}”
        </p>
      </div>

      {/* Product */}
      <div className="mt-6 border-t border-slate-100 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Purchased
        </p>

        <p className="mt-1 text-sm font-medium text-slate-800">
          {testimonial.product}
        </p>
      </div>
    </article>
  )
}

export default function Testimonials() {
  const [currentPage, setCurrentPage] = useState(0)

  const desktopPerPage = 3

  const totalPages = Math.ceil(
    testimonials.length / desktopPerPage
  )

  const currentTestimonials = testimonials.slice(
    currentPage * desktopPerPage,
    currentPage * desktopPerPage + desktopPerPage
  )

  const goNext = () => {
    setCurrentPage((page) =>
      page === totalPages - 1 ? 0 : page + 1
    )
  }

  const goPrevious = () => {
    setCurrentPage((page) =>
      page === 0 ? totalPages - 1 : page - 1
    )
  }

  return (
    <section className="bg-slate-50 py-20 sm:py-24">
      <div className="container-custom">
        {/* =====================================================
            HEADER
        ====================================================== */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold tracking-wide text-primary-600">
            CUSTOMER REVIEWS
          </p>

          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl lg:text-[2.75rem]">
            What our customers say
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-500 sm:text-lg">
            Trusted by customers across India for authentic products,
            traditional flavours, and dependable service.
          </p>
        </div>

        {/* =====================================================
            RATING SUMMARY
        ====================================================== */}
        <div className="mx-auto mt-8 flex w-fit flex-col items-center gap-3 sm:flex-row sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-slate-950">
              4.9
            </span>

            <Stars rating={5} />
          </div>

          <span className="hidden h-4 w-px bg-slate-300 sm:block" />

          <span className="text-sm text-slate-500">
            Based on 1,000+ reviews
          </span>
        </div>

        {/* =====================================================
            TESTIMONIAL GRID
        ====================================================== */}
        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {currentTestimonials.map((testimonial) => (
            <TestimonialCard
              key={testimonial.id}
              testimonial={testimonial}
            />
          ))}
        </div>

        {/* =====================================================
            NAVIGATION
        ====================================================== */}
        <div className="mt-8 flex items-center justify-center gap-5">
          <button
            type="button"
            onClick={goPrevious}
            aria-label="Previous testimonials"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-950 hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            <ChevronLeftIcon className="h-4.5 w-4.5" />
          </button>

          {/* Pagination */}
          <div className="flex items-center gap-2">
            {Array.from({ length: totalPages }).map(
              (_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setCurrentPage(index)}
                  aria-label={`Go to testimonial page ${index + 1}`}
                  aria-current={
                    currentPage === index ? 'true' : undefined
                  }
                  className={`h-1.5 rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                    currentPage === index
                      ? 'w-7 bg-primary-600'
                      : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                  }`}
                />
              )
            )}
          </div>

          <button
            type="button"
            onClick={goNext}
            aria-label="Next testimonials"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-950 hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            <ChevronRightIcon className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* =====================================================
            TRUST FOOTER
        ====================================================== */}
        <div className="mx-auto mt-12 max-w-2xl border-t border-slate-200 pt-7 text-center">
          <p className="text-sm leading-6 text-slate-500">
            We value every customer and work hard to deliver
            products that feel as good as they look.
          </p>
        </div>
      </div>
    </section>
  )
}