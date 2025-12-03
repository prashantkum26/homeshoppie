import { Country, countries, getCountryByCode, getCountryByDialCode } from './countries'

export interface PhoneValidationResult {
  isValid: boolean
  e164Format?: string
  nationalFormat?: string
  country?: Country
  error?: string
}

/**
 * Validates a phone number and converts it to E.164 format
 * @param phoneNumber - The phone number to validate
 * @param countryCode - The ISO country code (e.g., 'IN', 'US')
 * @returns PhoneValidationResult
 */
export function validatePhoneNumber(
  phoneNumber: string, 
  countryCode: string
): PhoneValidationResult {
  // Clean the phone number - remove all non-digit characters
  const cleanedNumber = phoneNumber.replace(/\D/g, '')
  
  if (!cleanedNumber) {
    return {
      isValid: false,
      error: 'Phone number is required'
    }
  }

  // Get country information
  const country = getCountryByCode(countryCode)
  if (!country) {
    return {
      isValid: false,
      error: 'Invalid country code'
    }
  }

  // Check if number starts with country dial code (without +)
  const dialCodeDigits = country.dialCode.replace('+', '')
  let nationalNumber = cleanedNumber

  // If the number includes the country code, extract the national number
  if (cleanedNumber.startsWith(dialCodeDigits)) {
    nationalNumber = cleanedNumber.substring(dialCodeDigits.length)
  }

  // Validate national number length
  if (nationalNumber.length < country.minLength || nationalNumber.length > country.maxLength) {
    return {
      isValid: false,
      error: `Phone number must be between ${country.minLength} and ${country.maxLength} digits for ${country.name}`
    }
  }

  // Additional validation rules
  if (!/^\d+$/.test(nationalNumber)) {
    return {
      isValid: false,
      error: 'Phone number must contain only digits'
    }
  }

  // Country-specific validation
  const countryValidation = validateCountrySpecificRules(nationalNumber, country)
  if (!countryValidation.isValid) {
    return countryValidation
  }

  // Generate formats
  const e164Format = country.dialCode + nationalNumber
  const nationalFormat = formatNationalNumber(nationalNumber, country)

  return {
    isValid: true,
    e164Format,
    nationalFormat,
    country
  }
}

/**
 * Validates country-specific phone number rules
 */
function validateCountrySpecificRules(
  nationalNumber: string, 
  country: Country
): { isValid: boolean; error?: string } {
  switch (country.code) {
    case 'IN':
      // Indian mobile numbers start with 6, 7, 8, or 9
      if (nationalNumber.length === 10 && !/^[6-9]/.test(nationalNumber)) {
        return {
          isValid: false,
          error: 'Indian mobile numbers must start with 6, 7, 8, or 9'
        }
      }
      break
    
    case 'US':
    case 'CA':
      // North American numbers: first digit of area code cannot be 0 or 1
      if (nationalNumber.length === 10 && /^[01]/.test(nationalNumber)) {
        return {
          isValid: false,
          error: 'Area code cannot start with 0 or 1'
        }
      }
      break
    
    case 'GB':
      // UK mobile numbers typically start with 7
      if (nationalNumber.length === 10 && nationalNumber.startsWith('0')) {
        // Remove leading 0 for UK numbers
        nationalNumber = nationalNumber.substring(1)
      }
      break
  }

  return { isValid: true }
}

/**
 * Formats a phone number for display in national format
 */
function formatNationalNumber(nationalNumber: string, country: Country): string {
  switch (country.code) {
    case 'IN':
      // Format: 98765 43210
      if (nationalNumber.length === 10) {
        return `${nationalNumber.slice(0, 5)} ${nationalNumber.slice(5)}`
      }
      break
    
    case 'US':
    case 'CA':
      // Format: (123) 456-7890
      if (nationalNumber.length === 10) {
        return `(${nationalNumber.slice(0, 3)}) ${nationalNumber.slice(3, 6)}-${nationalNumber.slice(6)}`
      }
      break
    
    case 'GB':
      // Format: 7700 123456
      if (nationalNumber.length === 10) {
        return `${nationalNumber.slice(0, 4)} ${nationalNumber.slice(4)}`
      }
      break
  }

  // Default formatting - add spaces every 3-4 digits
  return nationalNumber.replace(/(\d{3,4})(?=\d)/g, '$1 ')
}

/**
 * Parses a phone number string and attempts to extract country and number
 */
export function parsePhoneNumber(phoneNumber: string): {
  countryCode?: string
  nationalNumber?: string
  possibleCountries: Country[]
} {
  const cleaned = phoneNumber.replace(/\D/g, '')
  
  if (!cleaned) {
    return { possibleCountries: [] }
  }

  // Try to match against known dial codes
  const possibleCountries: Country[] = []
  
  for (const country of countries) {
    const dialCodeDigits = country.dialCode.replace('+', '')
    if (cleaned.startsWith(dialCodeDigits)) {
      const nationalNumber = cleaned.substring(dialCodeDigits.length)
      if (nationalNumber.length >= country.minLength && nationalNumber.length <= country.maxLength) {
        possibleCountries.push(country)
      }
    }
  }

  if (possibleCountries.length > 0) {
    const bestMatch = possibleCountries[0]
    const dialCodeDigits = bestMatch.dialCode.replace('+', '')
    return {
      countryCode: bestMatch.code,
      nationalNumber: cleaned.substring(dialCodeDigits.length),
      possibleCountries
    }
  }

  return { possibleCountries: [] }
}

/**
 * Converts E.164 format to display format
 */
export function formatE164ToDisplay(e164: string): string {
  if (!e164.startsWith('+')) {
    return e164
  }

  const country = getCountryByDialCode(e164.slice(0, -10)) // Rough approximation
  if (country) {
    const dialCodeLength = country.dialCode.length
    const nationalNumber = e164.substring(dialCodeLength)
    return `${country.dialCode} ${formatNationalNumber(nationalNumber, country)}`
  }

  return e164
}

/**
 * Validates if a string is in E.164 format
 */
export function isE164Format(phoneNumber: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phoneNumber)
}

/**
 * Gets suggested countries based on partial phone number input
 */
export function getSuggestedCountries(partialNumber: string): Country[] {
  const cleaned = partialNumber.replace(/\D/g, '')
  
  if (!cleaned) {
    return countries.slice(0, 5) // Return top 5 countries
  }

  const suggestions: Country[] = []
  
  for (const country of countries) {
    const dialCodeDigits = country.dialCode.replace('+', '')
    if (dialCodeDigits.startsWith(cleaned) || cleaned.startsWith(dialCodeDigits)) {
      suggestions.push(country)
    }
  }

  return suggestions.length > 0 ? suggestions : countries.slice(0, 5)
}
