'use client'

import { useState } from 'react'
import { StarIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid'

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
    comment: 'The cow ghee is absolutely pure and authentic! You can taste the difference. My family loves it and we order regularly.',
    product: 'Pure Cow Ghee',
    image: '/images/customer-1.jpg'
  },
  {
    id: 2,
    name: 'Rajesh Kumar',
    location: 'Mumbai',
    rating: 5,
    comment: 'Best mustard oil I have ever used. Cold-pressed and completely natural. Great for cooking and health benefits.',
    product: 'Mustard Oil',
    image: '/images/customer-2.jpg'
  },
  {
    id: 3,
    name: 'Sunita Devi',
    location: 'Patna',
    rating: 5,
    comment: 'The thekua tastes exactly like my grandmother used to make. So fresh and authentic. Perfect for festivals!',
    product: 'Traditional Thekua',
    image: '/images/customer-3.jpg'
  },
  {
    id: 4,
    name: 'Amit Gupta',
    location: 'Bangalore',
    rating: 5,
    comment: 'Amazing quality namkeen! Fresh, crispy and full of flavor. Great packaging and quick delivery too.',
    product: 'Mixed Namkeen',
    image: '/images/customer-4.jpg'
  },
  {
    id: 5,
    name: 'Kavita Singh',
    location: 'Kolkata',
    rating: 5,
    comment: 'The pooja items are of excellent quality. Brass diyas are beautifully crafted and the service is outstanding.',
    product: 'Brass Diya Set',
    image: '/images/customer-5.jpg'
  },
  {
    id: 6,
    name: 'Deepak Yadav',
    location: 'Lucknow',
    rating: 5,
    comment: 'Buffalo ghee bilona method is superb! Rich taste and aroma. HomeShoppie never disappoints with quality.',
    product: 'Buffalo Ghee',
    image: '/images/customer-6.jpg'
  }
]

function TestimonialCard({ testimonial }: TestimonialCardProps) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-lg transition-shadow duration-300">
      <div className="flex items-center mb-4">
        <div className="w-12 h-12 bg-gradient-to-br from-primary-200 to-primary-300 rounded-full flex items-center justify-center mr-4">
          <span className="text-lg font-semibold text-primary-700">
            {testimonial.name.charAt(0)}
          </span>
        </div>
        <div>
          <h4 className="font-semibold text-gray-900">{testimonial.name}</h4>
          <p className="text-sm text-gray-500">{testimonial.location}</p>
        </div>
      </div>

      <div className="flex items-center mb-3">
        {[...Array(5)].map((_, i) => (
          <StarIcon
            key={i}
            className={`h-4 w-4 ${
              i < testimonial.rating ? 'text-yellow-400' : 'text-gray-300'
            }`}
          />
        ))}
      </div>

      <p className="text-gray-600 mb-4 leading-relaxed">
        "{testimonial.comment}"
      </p>

      <div className="text-sm text-primary-600 font-medium">
        Verified purchase: {testimonial.product}
      </div>
    </div>
  )
}

export default function Testimonials() {
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const testimonialsPerPage = 3

  const nextTestimonials = (): void => {
    setCurrentIndex((prev) => 
      prev + testimonialsPerPage >= testimonials.length ? 0 : prev + testimonialsPerPage
    )
  }

  const prevTestimonials = (): void => {
    setCurrentIndex((prev) => 
      prev === 0 ? Math.max(0, testimonials.length - testimonialsPerPage) : prev - testimonialsPerPage
    )
  }

  const visibleTestimonials = testimonials.slice(currentIndex, currentIndex + testimonialsPerPage)

  return (
    <section className="py-16 bg-gray-50">
      <div className="container-custom">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            What Our Customers Say
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Read genuine reviews from our satisfied customers who trust us for 
            authentic homemade products
          </p>
        </div>

        {/* Desktop View */}
        <div className="hidden md:block relative">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleTestimonials.map((testimonial: Testimonial) => (
              <TestimonialCard key={testimonial.id} testimonial={testimonial} />
            ))}
          </div>

          {/* Navigation Arrows */}
          <button
            onClick={prevTestimonials}
            className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-4 bg-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 border"
            disabled={currentIndex === 0}
          >
            <ChevronLeftIcon className="h-5 w-5 text-gray-600" />
          </button>
          
          <button
            onClick={nextTestimonials}
            className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-4 bg-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 border"
            disabled={currentIndex + testimonialsPerPage >= testimonials.length}
          >
            <ChevronRightIcon className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Mobile View */}
        <div className="md:hidden">
          <div className="space-y-6">
            {testimonials.slice(0, 3).map((testimonial: Testimonial) => (
              <TestimonialCard key={testimonial.id} testimonial={testimonial} />
            ))}
          </div>
        </div>

        {/* Dots Indicator */}
        <div className="flex justify-center mt-8 space-x-2">
          {Array.from({ length: Math.ceil(testimonials.length / testimonialsPerPage) }).map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index * testimonialsPerPage)}
              className={`w-3 h-3 rounded-full transition-colors ${
                Math.floor(currentIndex / testimonialsPerPage) === index
                  ? 'bg-primary-600'
                  : 'bg-gray-300 hover:bg-gray-400'
              }`}
            />
          ))}
        </div>

        {/* Overall Rating */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center bg-white px-6 py-4 rounded-full shadow-sm border">
            <div className="flex items-center mr-4">
              <span className="text-2xl font-bold text-gray-900 mr-2">4.9</span>
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <StarIcon
                    key={i}
                    className="h-5 w-5 text-yellow-400"
                  />
                ))}
              </div>
            </div>
            <div className="text-left">
              <div className="text-sm font-medium text-gray-900">Excellent Rating</div>
              <div className="text-sm text-gray-500">Based on 1000+ reviews</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
