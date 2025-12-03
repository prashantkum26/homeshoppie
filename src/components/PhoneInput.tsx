'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { countries, Country, getDefaultCountry, getCountryByCode } from '@/lib/countries'
import { validatePhoneNumber, PhoneValidationResult } from '@/lib/phoneValidation'

interface PhoneInputProps {
  value: string
  onChange: (value: string, validation: PhoneValidationResult) => void
  countryCode?: string
  onCountryChange?: (countryCode: string) => void
  disabled?: boolean
  required?: boolean
  className?: string
  placeholder?: string
  error?: string
}

export default function PhoneInput({
  value,
  onChange,
  countryCode = 'IN',
  onCountryChange,
  disabled = false,
  required = false,
  className = '',
  placeholder,
  error
}: PhoneInputProps) {
  const [selectedCountry, setSelectedCountry] = useState<Country>(
    getCountryByCode(countryCode) || getDefaultCountry()
  )
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [phoneValue, setPhoneValue] = useState(value)
  const [validation, setValidation] = useState<PhoneValidationResult>({ isValid: true })
  
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Update selected country when countryCode prop changes
  useEffect(() => {
    const country = getCountryByCode(countryCode)
    if (country) {
      setSelectedCountry(country)
    }
  }, [countryCode])

  // Update phone value when value prop changes
  useEffect(() => {
    setPhoneValue(value)
  }, [value])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Validate phone number whenever it changes
  useEffect(() => {
    if (phoneValue) {
      const validationResult = validatePhoneNumber(phoneValue, selectedCountry.code)
      setValidation(validationResult)
      onChange(phoneValue, validationResult)
    } else {
      const emptyValidation = { isValid: !required }
      setValidation(emptyValidation)
      onChange('', emptyValidation)
    }
  }, [phoneValue, selectedCountry.code, required, onChange])

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country)
    setIsDropdownOpen(false)
    setSearchTerm('')
    onCountryChange?.(country.code)
    
    // Focus back to input
    inputRef.current?.focus()
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setPhoneValue(newValue)
  }

  const filteredCountries = countries.filter(country =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    country.dialCode.includes(searchTerm) ||
    country.code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getInputClassName = () => {
    const baseClass = `
      block w-full pl-20 pr-3 py-2 border rounded-md shadow-sm 
      focus:outline-none focus:ring-1 sm:text-sm
      ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
    `
    
    if (error || (phoneValue && !validation.isValid)) {
      return `${baseClass} border-red-300 focus:ring-red-500 focus:border-red-500`
    }
    
    if (phoneValue && validation.isValid) {
      return `${baseClass} border-green-300 focus:ring-green-500 focus:border-green-500`
    }
    
    return `${baseClass} border-gray-300 focus:ring-green-500 focus:border-green-500`
  }

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        {/* Country selector button */}
        <div className="absolute inset-y-0 left-0 flex items-center">
          <button
            type="button"
            onClick={() => !disabled && setIsDropdownOpen(!isDropdownOpen)}
            disabled={disabled}
            className={`
              inline-flex items-center px-3 py-2 border-r border-gray-300 text-sm
              ${disabled 
                ? 'bg-gray-100 cursor-not-allowed' 
                : 'bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-green-500'
              }
            `}
          >
            <span className="mr-1">{selectedCountry.flag}</span>
            <span className="text-gray-700">{selectedCountry.dialCode}</span>
            {!disabled && (
              <ChevronDownIcon 
                className={`ml-1 h-4 w-4 text-gray-400 transition-transform ${
                  isDropdownOpen ? 'rotate-180' : ''
                }`} 
              />
            )}
          </button>
        </div>

        {/* Phone number input */}
        <input
          ref={inputRef}
          type="tel"
          value={phoneValue}
          onChange={handlePhoneChange}
          disabled={disabled}
          required={required}
          placeholder={placeholder || `Enter phone number`}
          className={getInputClassName()}
        />

        {/* Country dropdown */}
        {isDropdownOpen && !disabled && (
          <div
            ref={dropdownRef}
            className="absolute z-50 left-0 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
          >
            {/* Search input */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-2">
              <input
                type="text"
                placeholder="Search countries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>

            {/* Country list */}
            <div className="max-h-48 overflow-y-auto">
              {filteredCountries.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => handleCountrySelect(country)}
                  className={`
                    w-full text-left px-4 py-2 hover:bg-gray-50 focus:outline-none focus:bg-gray-50
                    ${selectedCountry.code === country.code ? 'bg-green-50 text-green-700' : 'text-gray-700'}
                  `}
                >
                  <div className="flex items-center">
                    <span className="mr-3">{country.flag}</span>
                    <span className="flex-1">{country.name}</span>
                    <span className="text-gray-500 text-sm">{country.dialCode}</span>
                  </div>
                </button>
              ))}
              
              {filteredCountries.length === 0 && (
                <div className="px-4 py-2 text-gray-500 text-sm">
                  No countries found
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Validation feedback */}
      {phoneValue && !validation.isValid && validation.error && (
        <p className="mt-1 text-sm text-red-600">{validation.error}</p>
      )}
      
      {phoneValue && validation.isValid && validation.e164Format && (
        <p className="mt-1 text-sm text-green-600">
          ✓ Valid number: {validation.e164Format}
        </p>
      )}

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
