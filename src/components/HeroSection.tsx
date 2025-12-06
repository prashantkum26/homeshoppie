'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { getCategoryImagePath } from '@/utils/imageUtil'

interface HeroSlide {
  id: number
  title: string
  subtitle: string
  description: string
  image: string
  cta: string
  link: string
}

export default function HeroSection({ heroSlides }: { heroSlides: HeroSlide[] }) {
  const [currentSlide, setCurrentSlide] = useState<number>(0)

  // If heroSlides is empty -> return skeleton UI
  if (!heroSlides || heroSlides.length === 0) {
    return (
      <section className="relative h-[600px] bg-gray-100 animate-pulse">
        <div className="container-custom h-full flex items-center">
          <div className="w-full md:w-1/2 space-y-6">
            <div className="h-10 w-3/4 bg-gray-300 rounded"></div>
            <div className="h-6 w-1/2 bg-gray-300 rounded"></div>
            <div className="h-24 w-full bg-gray-300 rounded"></div>
            <div className="flex space-x-4">
              <div className="h-12 w-32 bg-gray-300 rounded"></div>
              <div className="h-12 w-32 bg-gray-300 rounded"></div>
            </div>
          </div>

          <div className="hidden md:flex w-1/2 items-center justify-center">
            <div className="h-96 w-full bg-gray-300 rounded-lg"></div>
          </div>
        </div>
      </section>
    );
  }

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
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
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
                <div className="text-6xl mb-4">
                  {getCategoryImagePath(heroSlides[currentSlide].title) ? (
                    <img
                      src={getCategoryImagePath(heroSlides[currentSlide].title)!}
                      alt={heroSlides[currentSlide].title}
                      className="w-full h-[200px] object-cover"
                      onError={(e) => {
                        // Fallback to emoji icon if image fails to load
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        const fallback = target.nextElementSibling as HTMLElement
                        if (fallback) fallback.style.display = 'flex'
                      }}
                    />
                  ) : <> 🥛 </>}
                </div>
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
              className={`w-3 h-3 rounded-full transition-all ${currentSlide === index
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
