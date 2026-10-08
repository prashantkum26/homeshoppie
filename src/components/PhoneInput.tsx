'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { ChevronDownIcon } from '@heroicons/react/24/outline'

import {
  countries,
  Country,
  getCountryByCode,
  getDefaultCountry,
} from '@/lib/countries'

import {
  PhoneValidationResult,
  validatePhoneNumber,
} from '@/lib/phoneValidation'

interface PhoneInputProps {
  id?: string
  value: string
  onChange: (
    value: string,
    validation: PhoneValidationResult
  ) => void

  countryCode?: string
  onCountryChange?: (countryCode: string) => void

  disabled?: boolean
  required?: boolean

  className?: string
  placeholder?: string
  error?: string
}

export default function PhoneInput({
  id,
  value,
  onChange,
  countryCode = 'IN',
  onCountryChange,
  disabled = false,
  required = false,
  className = '',
  placeholder = 'Enter your phone number',
  error,
}: PhoneInputProps) {
  // ============================================================
  // COUNTRY
  // ============================================================

  const initialCountry =
    getCountryByCode(countryCode) ||
    getDefaultCountry()

  const [selectedCountry, setSelectedCountry] =
    useState<Country>(initialCountry)

  // ============================================================
  // PHONE
  // ============================================================

  const [phoneValue, setPhoneValue] =
    useState<string>(value)

  // ============================================================
  // DROPDOWN
  // ============================================================

  const [isDropdownOpen, setIsDropdownOpen] =
    useState(false)

  const [searchTerm, setSearchTerm] =
    useState('')

  // ============================================================
  // REFS
  // ============================================================

  const containerRef =
    useRef<HTMLDivElement>(null)

  const phoneInputRef =
    useRef<HTMLInputElement>(null)

  const searchInputRef =
    useRef<HTMLInputElement>(null)

  // ============================================================
  // SYNC COUNTRY FROM PARENT
  // ============================================================

  useEffect(() => {
    const country =
      getCountryByCode(countryCode)

    if (
      country &&
      country.code !== selectedCountry.code
    ) {
      setSelectedCountry(country)
    }
  }, [countryCode, selectedCountry.code])

  // ============================================================
  // SYNC PHONE VALUE FROM PARENT
  // ============================================================

  useEffect(() => {
    if (value !== phoneValue) {
      setPhoneValue(value)
    }
  }, [value, phoneValue])

  // ============================================================
  // VALIDATION
  //
  // IMPORTANT:
  // This is calculated during render.
  // We do NOT use an effect here.
  //
  // This prevents:
  //
  // PhoneInput
  //   ↓
  // useEffect
  //   ↓
  // onChange
  //   ↓
  // parent render
  //   ↓
  // onChange function changes
  //   ↓
  // useEffect
  //   ↓
  // infinite loop
  // ============================================================

  const validation: PhoneValidationResult =
    phoneValue
      ? validatePhoneNumber(
          phoneValue,
          selectedCountry.code
        )
      : {
          isValid: !required,
        }

  // ============================================================
  // CLICK OUTSIDE
  // ============================================================

  useEffect(() => {
    if (!isDropdownOpen) {
      return
    }

    const handleClickOutside = (
      event: MouseEvent
    ) => {
      const target =
        event.target as Node

      if (
        containerRef.current &&
        !containerRef.current.contains(target)
      ) {
        setIsDropdownOpen(false)
        setSearchTerm('')
      }
    }

    document.addEventListener(
      'mousedown',
      handleClickOutside
    )

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside
      )
    }
  }, [isDropdownOpen])

  // ============================================================
  // NOTIFY PARENT
  // ============================================================

  const notifyParent = useCallback(
    (
      phone: string,
      country: Country
    ) => {
      const result: PhoneValidationResult =
        phone
          ? validatePhoneNumber(
              phone,
              country.code
            )
          : {
              isValid: !required,
            }

      onChange(phone, result)
    },
    [onChange, required]
  )

  // ============================================================
  // PHONE CHANGE
  // ============================================================

  const handlePhoneChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newValue =
      event.target.value

    setPhoneValue(newValue)

    notifyParent(
      newValue,
      selectedCountry
    )
  }

  // ============================================================
  // COUNTRY SELECT
  // ============================================================

  const handleCountrySelect = (
    country: Country
  ) => {
    setSelectedCountry(country)

    setIsDropdownOpen(false)
    setSearchTerm('')

    onCountryChange?.(country.code)

    // Revalidate current number
    // against the new country.
    notifyParent(
      phoneValue,
      country
    )

    // Return focus to phone input.
    requestAnimationFrame(() => {
      phoneInputRef.current?.focus()
    })
  }

  // ============================================================
  // TOGGLE DROPDOWN
  // ============================================================

  const handleToggleDropdown = () => {
    if (disabled) {
      return
    }

    setIsDropdownOpen(
      (previous) => !previous
    )

    setSearchTerm('')

    if (!isDropdownOpen) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus()
      })
    }
  }

  // ============================================================
  // SEARCH
  // ============================================================

  const filteredCountries =
    useMemo(() => {
      const search =
        searchTerm
          .trim()
          .toLowerCase()

      if (!search) {
        return countries
      }

      return countries.filter(
        (country) => {
          const name =
            country.name.toLowerCase()

          const code =
            country.code.toLowerCase()

          const dialCode =
            country.dialCode.toLowerCase()

          return (
            name.includes(search) ||
            code.includes(search) ||
            dialCode.includes(search)
          )
        }
      )
    }, [searchTerm])

  // ============================================================
  // STATES
  // ============================================================

  const hasError =
    Boolean(
      error ||
        (phoneValue &&
          !validation.isValid)
    )

  const isValid =
    Boolean(
      phoneValue &&
        validation.isValid
    )

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
    >
      {/* ====================================================== */}
      {/* PHONE FIELD */}
      {/* ====================================================== */}

      <div
        className={`flex w-full overflow-hidden rounded-md border bg-white shadow-sm transition ${
          disabled
            ? 'border-gray-300 bg-gray-100'
            : hasError
              ? 'border-red-300 focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-500'
              : isValid
                ? 'border-green-300 focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500'
                : 'border-gray-300 focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500'
        }`}
      >
        {/* ==================================================== */}
        {/* COUNTRY BUTTON */}
        {/* ==================================================== */}

        <button
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isDropdownOpen}
          aria-label={`Selected country: ${selectedCountry.name} ${selectedCountry.dialCode}`}
          onClick={handleToggleDropdown}
          className={`flex h-[54px] w-[142px] shrink-0 items-center justify-center gap-1.5 border-r border-gray-300 px-3 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-500 ${
            disabled
              ? 'cursor-not-allowed bg-gray-100'
              : 'bg-gray-50 hover:bg-gray-100'
          }`}
        >
          {/* Flag */}
          <span
            aria-hidden="true"
            className="text-base leading-none"
          >
            {selectedCountry.flag}
          </span>

          {/* ISO Code */}
          <span className="font-medium text-gray-700">
            {selectedCountry.code}
          </span>

          {/* Dial Code */}
          <span className="text-gray-700">
            {selectedCountry.dialCode}
          </span>

          {/* Arrow */}
          {!disabled && (
            <ChevronDownIcon
              aria-hidden="true"
              className={`ml-0.5 h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${
                isDropdownOpen
                  ? 'rotate-180'
                  : ''
              }`}
            />
          )}
        </button>

        {/* ==================================================== */}
        {/* PHONE INPUT */}
        {/* ==================================================== */}

        <input
          id={id}
          ref={phoneInputRef}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phoneValue}
          onChange={handlePhoneChange}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          aria-invalid={hasError}
          aria-describedby={
            hasError
              ? 'phone-error'
              : isValid
                ? 'phone-success'
                : undefined
          }
          className={`min-w-0 flex-1 border-0 bg-transparent px-4 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:border-0 focus:outline-none focus:ring-0 ${
            disabled
              ? 'cursor-not-allowed bg-gray-100 text-gray-500'
              : ''
          }`}
        />
      </div>

      {/* ====================================================== */}
      {/* COUNTRY DROPDOWN */}
      {/* ====================================================== */}

      {isDropdownOpen &&
        !disabled && (
          <div
            className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl"
            role="dialog"
            aria-label="Select country"
          >
            {/* Search */}
            <div className="border-b border-gray-200 bg-white p-3">
              <input
                ref={searchInputRef}
                type="search"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(
                    event.target.value
                  )
                }
                placeholder="Search country..."
                autoComplete="off"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500"
              />
            </div>

            {/* Country list */}
            <div
              className="max-h-64 overflow-y-auto py-1"
              role="listbox"
            >
              {filteredCountries.length >
              0 ? (
                filteredCountries.map(
                  (country) => {
                    const selected =
                      selectedCountry.code ===
                      country.code

                    return (
                      <button
                        key={
                          country.code
                        }
                        type="button"
                        role="option"
                        aria-selected={
                          selected
                        }
                        onClick={() =>
                          handleCountrySelect(
                            country
                          )
                        }
                        className={`flex w-full items-center px-4 py-2.5 text-left transition-colors focus:outline-none focus-visible:bg-green-50 ${
                          selected
                            ? 'bg-green-50'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        {/* Flag */}
                        <span
                          aria-hidden="true"
                          className="mr-3 text-lg leading-none"
                        >
                          {
                            country.flag
                          }
                        </span>

                        {/* Name */}
                        <span
                          className={`flex-1 text-sm ${
                            selected
                              ? 'font-medium text-green-700'
                              : 'text-gray-700'
                          }`}
                        >
                          {
                            country.name
                          }
                        </span>

                        {/* Dial code */}
                        <span className="text-sm text-gray-500">
                          {
                            country.dialCode
                          }
                        </span>
                      </button>
                    )
                  }
                )
              ) : (
                <div className="px-4 py-6 text-center text-sm text-gray-500">
                  No countries found
                </div>
              )}
            </div>
          </div>
        )}

      {/* ====================================================== */}
      {/* VALIDATION MESSAGE */}
      {/* ====================================================== */}

      {hasError &&
        phoneValue &&
        validation.error && (
          <p
            id="phone-error"
            role="alert"
            className="mt-1.5 text-sm text-red-600"
          >
            {validation.error}
          </p>
        )}

      {/* ====================================================== */}
      {/* SUCCESS MESSAGE */}
      {/* ====================================================== */}

      {isValid &&
        validation.e164Format && (
          <p
            id="phone-success"
            className="mt-1.5 text-sm text-green-600"
          >
            ✓ Valid phone number
          </p>
        )}

      {/* ====================================================== */}
      {/* EXTERNAL ERROR */}
      {/* ====================================================== */}

      {error && (
        <p
          role="alert"
          className="mt-1.5 text-sm text-red-600"
        >
          {error}
        </p>
      )}
    </div>
  )
}