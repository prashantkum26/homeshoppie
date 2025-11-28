'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface HeroSlide {
  id: number
  title: string
  subtitle: string
  description: string
  image: string
  cta: string
  link: string
}

const heroSlides: HeroSlide[] = [
  {
    id: 1,
    title: "Premium Homemade Ghee",
    subtitle: "Pure, Traditional & Authentic",
    description: "Made from fresh cow and buffalo milk using traditional bilona method. Rich in nutrients and flavor.",
    image: "/images/ghee-hero.jpg",
    cta: "Shop Ghee",
    link: "/categories/ghee"
  },
  {
    id: 2,
    title: "Fresh Mustard Oil",
    subtitle: "Cold-Pressed from Sarso Mill",
    description: "Pure mustard oil extracted using traditional methods. Perfect for cooking and health benefits.",
    image: "/images/oil-hero.jpg",
    cta: "Shop Oil",
    link: "/categories/oils"
  },
  {
    id: 3,
    title: "Traditional Sweets",
    subtitle: "Thekua, Gujiya & More",
    description: "Handmade traditional sweets prepared with love and authentic recipes passed down through generations.",
    image: "/images/sweets-hero.jpg",
    cta: "Shop Sweets",
    link: "/categories/sweets"
  }
]

export default function HeroSection() {
  const [currentSlide, setCurrentSlide] = useState<number>(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length)
    }, 5000)

    return () => clearInterval(timer)
  }, [])

  const nextSlide = (): void => {
    setCurrentSlide((prev) => (prev + 1) % heroSlides.length)
  }

  const prevSlide = (): void => {
    setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length)
  }

  const goToSlide = (index: number): void => {
    setCurrentSlide(index)
  }

  return (
    <section className="relative h-[600px] bg-gradient-to-r from-primary-50 to-secondary-50 overflow-hidden">
      <div className="container-custom h-full">
        <div className="flex items-center h-full">
          <div className="w-full md:w-1/2 pr-8">
            <div className="animate-fadeIn">
              <h1 className="text-hero text-gray-900 mb-6">
                {heroSlides[currentSlide].title}
              </h1>
              <h2 className="text-subtitle text-primary-600 mb-8">
                {heroSlides[currentSlide].subtitle}
              </h2>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                {heroSlides[currentSlide].description}
              </p>
              <div className="flex space-x-4">
                <Link
                  href={heroSlides[currentSlide].link}
                  className="btn-primary px-8 py-3 text-lg"
                >
                  {heroSlides[currentSlide].cta}
                </Link>
                <Link
                  href="/products"
                  className="btn-outline px-8 py-3 text-lg"
                >
                  View All Products
                </Link>
              </div>
            </div>
          </div>

          {/* Hero Image Placeholder */}
          <div className="hidden md:block w-1/2">
            <div className="relative h-96 bg-gradient-to-br from-primary-200 to-primary-300 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">🥛</div>
                <p className="text-primary-800 font-semibold">
                  {heroSlides[currentSlide].title}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Arrows */}
        <button
          onClick={prevSlide}
          className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full shadow-lg transition-all"
        >
          <ChevronLeftIcon className="h-6 w-6 text-gray-700" />
        </button>
        <button
          onClick={nextSlide}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full shadow-lg transition-all"
        >
          <ChevronRightIcon className="h-6 w-6 text-gray-700" />
        </button>

        {/* Slide Indicators */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-2">
          {heroSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                currentSlide === index
                  ? 'bg-primary-600'
                  : 'bg-white/50 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
