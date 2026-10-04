'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'
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

export default function HeroSection({
  heroSlides,
}: {
  heroSlides: HeroSlide[]
}) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [imageError, setImageError] = useState(false)

  const hasSlides = heroSlides && heroSlides.length > 0

  useEffect(() => {
    if (!hasSlides || heroSlides.length <= 1) return

    const timer = window.setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length)
    }, 5000)

    return () => window.clearInterval(timer)
  }, [hasSlides, heroSlides.length])

  useEffect(() => {
    setImageError(false)
  }, [currentSlide])

  if (!hasSlides) {
    return (
      <section className="bg-[#faf9f5] px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-7xl animate-pulse">
          <div className="grid overflow-hidden rounded-[24px] bg-white lg:grid-cols-2">
            <div className="order-2 space-y-5 p-7 lg:order-1 lg:p-14">
              <div className="h-5 w-32 rounded-full bg-stone-200" />
              <div className="h-12 w-4/5 rounded-xl bg-stone-200" />
              <div className="h-5 w-2/3 rounded bg-stone-200" />
              <div className="h-16 rounded-xl bg-stone-200" />
              <div className="h-12 w-40 rounded-xl bg-stone-200" />
            </div>

            <div className="order-1 h-[300px] bg-stone-200 lg:order-2 lg:h-[500px]" />
          </div>
        </div>
      </section>
    )
  }

  const slide = heroSlides[currentSlide]

  const imagePath =
    !imageError
      ? getCategoryImagePath(slide.title) || slide.image
      : null

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % heroSlides.length)
  }

  const prevSlide = () => {
    setCurrentSlide(
      (prev) => (prev - 1 + heroSlides.length) % heroSlides.length
    )
  }

  return (
    <section className="relative overflow-hidden bg-[#faf9f5]">
      {/* =====================================================
          DESKTOP / TABLET
      ===================================================== */}

      <div className="mx-auto hidden max-w-7xl px-6 py-8 lg:block lg:px-8 lg:py-10">
        <div className="relative overflow-hidden rounded-[28px] border border-stone-200/70 bg-white shadow-[0_20px_60px_rgba(28,25,23,0.08)]">
          <div className="grid min-h-[500px] grid-cols-[0.92fr_1.08fr]">
            {/* Content */}
            <div className="flex items-center px-12 py-12 xl:px-16">
              <div className="max-w-xl">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />

                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                    Fresh &amp; Authentic
                  </span>
                </div>

                <h1 className="text-5xl font-bold leading-[1.05] tracking-[-0.04em] text-slate-950 xl:text-[3.7rem]">
                  {slide.title}
                </h1>

                <p className="mt-5 text-xl font-medium leading-7 text-amber-700">
                  {slide.subtitle}
                </p>

                <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">
                  {slide.description}
                </p>

                <div className="mt-8 flex items-center gap-3">
                  <Link
                    href={slide.link}
                    className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-800"
                  >
                    {slide.cta}

                    <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>

                  <Link
                    href="/products"
                    className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Explore Products
                  </Link>
                </div>

                <div className="mt-8 flex gap-6 text-xs font-medium text-slate-500">
                  <span>✓ Quality products</span>
                  <span>✓ Carefully packed</span>
                </div>
              </div>
            </div>

            {/* Image */}
            <div className="relative min-h-[500px] overflow-hidden bg-gradient-to-br from-amber-100 via-yellow-50 to-orange-100">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/40 blur-3xl" />

              <div className="absolute inset-7 overflow-hidden rounded-[22px] bg-white shadow-[0_18px_45px_rgba(120,80,20,0.14)]">
                {imagePath ? (
                  <img
                    src={imagePath}
                    alt={slide.title}
                    className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.025]"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-amber-50">
                    <span className="text-7xl">🥨</span>
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/25 to-transparent" />

                <div className="absolute bottom-5 left-5 rounded-xl border border-white/50 bg-white/90 px-4 py-2 shadow-lg backdrop-blur-md">
                  <p className="text-sm font-semibold text-slate-900">
                    {slide.title}
                  </p>
                </div>
              </div>

              {heroSlides.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prevSlide}
                    aria-label="Previous slide"
                    className="absolute left-5 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-white/90 text-slate-700 shadow-lg transition hover:scale-105"
                  >
                    <ChevronLeftIcon className="h-5 w-5" />
                  </button>

                  <button
                    type="button"
                    onClick={nextSlide}
                    aria-label="Next slide"
                    className="absolute right-5 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-white/90 text-slate-700 shadow-lg transition hover:scale-105"
                  >
                    <ChevronRightIcon className="h-5 w-5" />
                  </button>
                </>
              )}

              {heroSlides.length > 1 && (
                <div className="absolute right-6 top-6 z-20 rounded-full border border-white/60 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-md">
                  {String(currentSlide + 1).padStart(2, '0')}
                  <span className="mx-1 text-slate-400">/</span>
                  {String(heroSlides.length).padStart(2, '0')}
                </div>
              )}
            </div>
          </div>

          {heroSlides.length > 1 && (
            <div className="absolute bottom-5 left-12 z-30 flex items-center gap-2">
              {heroSlides.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrentSlide(index)}
                  aria-label={`Go to slide ${index + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    currentSlide === index
                      ? 'w-8 bg-slate-950'
                      : 'w-2 bg-slate-300 hover:bg-slate-400'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* =====================================================
          MOBILE / SMALL TABLET
      ===================================================== */}

      <div className="px-4 py-4 sm:px-6 sm:py-6 lg:hidden">
        <div className="relative overflow-hidden rounded-[24px] border border-stone-200/80 bg-white shadow-[0_12px_40px_rgba(28,25,23,0.08)]">

          {/* Mobile Image */}
          <div className="relative h-[280px] overflow-hidden bg-gradient-to-br from-amber-100 via-yellow-50 to-orange-100 sm:h-[340px]">
            {imagePath ? (
              <img
                src={imagePath}
                alt={slide.title}
                className="h-full w-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-amber-50">
                <span className="text-6xl">🥨</span>
              </div>
            )}

            {/* Image gradient */}
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/25 to-transparent" />

            {/* Top badge */}
            <div className="absolute left-4 top-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/85 px-3 py-1.5 shadow-sm backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />

                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-700">
                  Fresh &amp; Authentic
                </span>
              </div>
            </div>

            {/* Counter */}
            {heroSlides.length > 1 && (
              <div className="absolute right-4 top-4 rounded-full border border-white/50 bg-white/85 px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur-md">
                {String(currentSlide + 1).padStart(2, '0')}
                <span className="mx-1 text-slate-400">/</span>
                {String(heroSlides.length).padStart(2, '0')}
              </div>
            )}

            {/* Image arrows */}
            {heroSlides.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prevSlide}
                  aria-label="Previous slide"
                  className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-lg backdrop-blur transition active:scale-95"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  onClick={nextSlide}
                  aria-label="Next slide"
                  className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-lg backdrop-blur transition active:scale-95"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </>
            )}
          </div>

          {/* Mobile Content */}
          <div className="px-5 pb-5 pt-5 sm:px-7 sm:pb-7">

            {/* Title */}
            <h1 className="text-[2rem] font-bold leading-[1.05] tracking-[-0.035em] text-slate-950 sm:text-4xl">
              {slide.title}
            </h1>

            {/* Subtitle */}
            <p className="mt-2.5 text-[15px] font-medium leading-6 text-amber-700 sm:text-base">
              {slide.subtitle}
            </p>

            {/* Description */}
            <p className="mt-2.5 line-clamp-2 text-sm leading-6 text-slate-600">
              {slide.description}
            </p>

            {/* CTA */}
            <Link
              href={slide.link}
              className="group mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 transition active:scale-[0.985]"
            >
              {slide.cta}

              <ArrowRightIcon className="h-4 w-4 transition-transform group-active:translate-x-1" />
            </Link>

            {/* Small trust row */}
            <div className="mt-4 flex items-center justify-center gap-4 text-[10px] font-medium text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-600">✓</span>
                Quality
              </span>

              <span className="h-3 w-px bg-slate-200" />

              <span className="flex items-center gap-1.5">
                <span className="text-emerald-600">✓</span>
                Carefully packed
              </span>
            </div>

            {/* Dots */}
            {heroSlides.length > 1 && (
              <div className="mt-5 flex justify-center gap-2">
                {heroSlides.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCurrentSlide(index)}
                    aria-label={`Go to slide ${index + 1}`}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      currentSlide === index
                        ? 'w-8 bg-slate-950'
                        : 'w-1.5 bg-slate-300'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}