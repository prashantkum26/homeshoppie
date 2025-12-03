'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useDebounce } from '@/hooks/useDebounce'
import Link from 'next/link'

interface SearchResult {
  id: string
  type: 'product' | 'category' | 'user' | 'order'
  name: string
  subtitle?: string
  url: string
  price?: number
  image?: string
}

interface SearchBarProps {
  placeholder?: string
  className?: string
  showCategories?: boolean
  isMobile?: boolean
}

export default function SearchBar({ 
  placeholder = "Search products, categories...", 
  className = "",
  showCategories = true,
  isMobile = false
}: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  
  // Debounce search query
  const debouncedQuery = useDebounce(query, 300)
  
  // Search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([])
      setIsLoading(false)
      return
    }
    
    setIsLoading(true)
    
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        type: 'all',
        limit: '8'
      })
      
      const response = await fetch(`/api/search?${params}`)
      const data = await response.json()
      
      if (data.success) {
        // Flatten results from different categories
        const flatResults: SearchResult[] = [
          ...data.results.products,
          ...(showCategories ? data.results.categories : []),
          ...data.results.orders,
          ...data.results.users
        ]
        
        setResults(flatResults)
        setIsOpen(flatResults.length > 0)
      } else {
        setResults([])
        setIsOpen(false)
      }
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
      setIsOpen(false)
    } finally {
      setIsLoading(false)
    }
  }, [showCategories])
  
  // Effect for debounced search
  useEffect(() => {
    if (debouncedQuery) {
      performSearch(debouncedQuery)
    } else {
      setResults([])
      setIsOpen(false)
      setIsLoading(false)
    }
  }, [debouncedQuery, performSearch])
  
  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    setSelectedIndex(-1)
    
    if (value.length === 0) {
      setResults([])
      setIsOpen(false)
    }
  }
  
  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > -1 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0) {
          handleResultClick(results[selectedIndex])
        } else if (query.trim()) {
          handleSearch()
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSelectedIndex(-1)
        inputRef.current?.blur()
        break
    }
  }
  
  // Handle result click
  const handleResultClick = (result: SearchResult) => {
    setQuery('')
    setIsOpen(false)
    setSelectedIndex(-1)
    router.push(result.url)
  }
  
  // Handle search submission
  const handleSearch = () => {
    if (query.trim()) {
      const searchParams = new URLSearchParams({ q: query.trim() })
      router.push(`/search?${searchParams}`)
      setQuery('')
      setIsOpen(false)
      setSelectedIndex(-1)
    }
  }
  
  // Handle clear
  const handleClear = () => {
    setQuery('')
    setResults([])
    setIsOpen(false)
    setSelectedIndex(-1)
    inputRef.current?.focus()
  }
  
  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSelectedIndex(-1)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  // Get result icon based on type
  const getResultIcon = (type: string) => {
    switch (type) {
      case 'product':
        return '🛍️'
      case 'category':
        return '📂'
      case 'order':
        return '📦'
      case 'user':
        return '👤'
      default:
        return '🔍'
    }
  }
  
  return (
    <div ref={searchRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true)
          }}
          placeholder={placeholder}
          className={`
            block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md 
            leading-5 bg-white placeholder-gray-500 text-gray-900
            focus:outline-none focus:placeholder-gray-400 focus:ring-1 
            focus:ring-primary-500 focus:border-primary-500 transition-colors
            ${isMobile ? 'text-base' : 'text-sm'}
          `}
        />
        
        {/* Clear button */}
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-gray-600"
          >
            <XMarkIcon className="h-4 w-4 text-gray-400" />
          </button>
        )}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-600 border-t-transparent" />
          </div>
        )}
      </div>
      
      {/* Search Results Dropdown */}
      {isOpen && (results.length > 0 || isLoading) && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-96 overflow-y-auto">
          {/* Loading state */}
          {isLoading && results.length === 0 && (
            <div className="px-4 py-3 text-center text-gray-500 text-sm">
              Searching...
            </div>
          )}
          
          {/* Results */}
          {results.map((result, index) => (
            <button
              key={`${result.type}-${result.id}`}
              onClick={() => handleResultClick(result)}
              className={`
                w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100
                focus:outline-none focus:bg-gray-50 transition-colors
                ${selectedIndex === index ? 'bg-primary-50 border-primary-200' : ''}
              `}
            >
              <div className="flex items-center space-x-3">
                <span className="text-lg flex-shrink-0">
                  {getResultIcon(result.type)}
                </span>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {result.name}
                    </p>
                    
                    {result.price && (
                      <span className="text-sm font-semibold text-primary-600 ml-2">
                        ₹{result.price.toFixed(2)}
                      </span>
                    )}
                  </div>
                  
                  {result.subtitle && (
                    <p className="text-xs text-gray-500 truncate mt-1">
                      {result.subtitle}
                    </p>
                  )}
                </div>
                
                <div className="flex-shrink-0">
                  <span className={`
                    px-2 py-1 text-xs rounded-full font-medium
                    ${result.type === 'product' ? 'bg-blue-100 text-blue-800' :
                      result.type === 'category' ? 'bg-green-100 text-green-800' :
                      result.type === 'order' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'}
                  `}>
                    {result.type}
                  </span>
                </div>
              </div>
            </button>
          ))}
          
          {/* View all results */}
          {query.trim() && results.length > 0 && (
            <button
              onClick={handleSearch}
              className="w-full px-4 py-3 text-left text-sm text-primary-600 hover:bg-primary-50 font-medium"
            >
              View all results for "{query}"
            </button>
          )}
          
          {/* No results */}
          {!isLoading && results.length === 0 && query.length >= 2 && (
            <div className="px-4 py-3 text-center text-gray-500 text-sm">
              No results found for "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  )
}
