'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  ShoppingBagIcon,
  ArrowRightIcon,
  FunnelIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline'
import { getCategoryIcon, getCategoryImagePath } from '@/utils/imageUtil'

interface Category {
  id: string
  name: string
  description: string
  slug: string
  image?: string
  _count?: {
    products: number
  }
}

const getCategoryColor = (categoryName: string) => {
  switch (categoryName) {
    case 'Ghee': return 'from-yellow-100 to-yellow-200'
    case 'Oils': return 'from-green-100 to-green-200'
    case 'Sweets': return 'from-orange-100 to-orange-200'
    case 'Namkeen': return 'from-red-100 to-red-200'
    case 'Pooja Items': return 'from-pink-100 to-pink-200'
    default: return 'from-gray-100 to-gray-200'
  }
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    let isMounted = true
    
    const fetchCategories = async () => {
      if (!isMounted) return
      
      try {
        const response = await fetch('/api/categories')
        if (!response.ok) throw new Error('Failed to fetch categories')
        
        const result = await response.json()
        // Handle the wrapped API response
        const categories = result.success ? result.data : []
        
        if (isMounted) {
          setCategories(categories || [])
          setLoading(false)
        }
      } catch (error) {
        console.error('Error fetching categories:', error)
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchCategories()

    return () => {
      isMounted = false
    }
  }, [])

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    category.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary-50 to-primary-100 py-16">
        <div className="container-custom">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Shop by Category
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Discover our premium collection of authentic products organized by category. 
              From pure ghee to traditional sweets, find everything you need for your kitchen and spiritual needs.
            </p>
            
            {/* Search Bar */}
            <div className="max-w-md mx-auto">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search categories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="container-custom py-16">
        {filteredCategories.length > 0 ? (
          <>
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                {searchQuery ? `Found ${filteredCategories.length} categories` : 'All Categories'}
              </h2>
              <p className="text-lg text-gray-600">
                Choose a category to explore our premium products
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredCategories.map((category) => (
                <Link
                  key={category.id}
                  href={`/categories/${category.slug}`}
                  className="group block"
                >
                  <div className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 transform group-hover:scale-105 overflow-hidden border border-gray-200">
                    <div className={`bg-gradient-to-br ${getCategoryColor(category.name)} p-8 text-center`}>
                      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:shadow-xl transition-shadow overflow-hidden">
                        {getCategoryImagePath(category.name) ? (
                          <img
                            src={getCategoryImagePath(category.name)!}
                            alt={category.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback to emoji icon if image fails to load
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                              const fallback = target.nextElementSibling as HTMLElement
                              if (fallback) fallback.style.display = 'flex'
                            }}
                          />
                        ) : null}
                        {/* Fallback emoji - shown when no image or image fails to load */}
                        <div 
                          className={`w-full h-full flex items-center justify-center ${
                            getCategoryImagePath(category.name) ? 'hidden' : 'flex'
                          }`}
                        >
                          <span className="text-4xl">{getCategoryIcon(category.name)}</span>
                        </div>
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors">
                        {category.name}
                      </h3>
                      <p className="text-gray-700 mb-4">
                        {category.description}
                      </p>
                      {category._count?.products !== undefined && (
                        <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 text-sm font-medium text-gray-700">
                          <ShoppingBagIcon className="h-4 w-4" />
                          {category._count.products} products
                        </div>
                      )}
                    </div>
                    
                    <div className="p-6">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                          Explore Category
                        </span>
                        <ArrowRightIcon className="h-5 w-5 text-gray-400 group-hover:text-primary-600 group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-16">
            <FunnelIcon className="h-16 w-16 text-gray-300 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">No categories found</h2>
            <p className="text-gray-600 mb-8">
              {searchQuery 
                ? `No categories match "${searchQuery}". Try a different search term.`
                : 'No categories are available at the moment.'
              }
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="btn-primary px-6 py-3"
              >
                Clear Search
              </button>
            )}
          </div>
        )}
      </div>

      {/* Call to Action */}
      <div className="bg-gray-50 py-16">
        <div className="container-custom text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Need Help Finding Something?
          </h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Our team is here to help you find the perfect products for your needs. 
            Contact us for personalized recommendations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/products"
              className="btn-primary px-6 py-3"
            >
              Browse All Products
            </Link>
            <Link
              href="/contact"
              className="btn-secondary px-6 py-3"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
