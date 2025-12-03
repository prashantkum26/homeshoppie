export interface Country {
  code: string
  name: string
  dialCode: string
  flag: string
  minLength: number
  maxLength: number
}

export const countries: Country[] = [
  {
    code: 'IN',
    name: 'India',
    dialCode: '+91',
    flag: '🇮🇳',
    minLength: 10,
    maxLength: 10
  },
  {
    code: 'US',
    name: 'United States',
    dialCode: '+1',
    flag: '🇺🇸',
    minLength: 10,
    maxLength: 10
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    dialCode: '+44',
    flag: '🇬🇧',
    minLength: 10,
    maxLength: 11
  },
  {
    code: 'CA',
    name: 'Canada',
    dialCode: '+1',
    flag: '🇨🇦',
    minLength: 10,
    maxLength: 10
  },
  {
    code: 'AU',
    name: 'Australia',
    dialCode: '+61',
    flag: '🇦🇺',
    minLength: 9,
    maxLength: 10
  },
  {
    code: 'DE',
    name: 'Germany',
    dialCode: '+49',
    flag: '🇩🇪',
    minLength: 10,
    maxLength: 12
  },
  {
    code: 'FR',
    name: 'France',
    dialCode: '+33',
    flag: '🇫🇷',
    minLength: 10,
    maxLength: 10
  },
  {
    code: 'JP',
    name: 'Japan',
    dialCode: '+81',
    flag: '🇯🇵',
    minLength: 10,
    maxLength: 11
  },
  {
    code: 'CN',
    name: 'China',
    dialCode: '+86',
    flag: '🇨🇳',
    minLength: 11,
    maxLength: 11
  },
  {
    code: 'BR',
    name: 'Brazil',
    dialCode: '+55',
    flag: '🇧🇷',
    minLength: 10,
    maxLength: 11
  },
  {
    code: 'MX',
    name: 'Mexico',
    dialCode: '+52',
    flag: '🇲🇽',
    minLength: 10,
    maxLength: 10
  },
  {
    code: 'RU',
    name: 'Russia',
    dialCode: '+7',
    flag: '🇷🇺',
    minLength: 10,
    maxLength: 10
  },
  {
    code: 'KR',
    name: 'South Korea',
    dialCode: '+82',
    flag: '🇰🇷',
    minLength: 10,
    maxLength: 11
  },
  {
    code: 'IT',
    name: 'Italy',
    dialCode: '+39',
    flag: '🇮🇹',
    minLength: 9,
    maxLength: 11
  },
  {
    code: 'ES',
    name: 'Spain',
    dialCode: '+34',
    flag: '🇪🇸',
    minLength: 9,
    maxLength: 9
  },
  {
    code: 'NL',
    name: 'Netherlands',
    dialCode: '+31',
    flag: '🇳🇱',
    minLength: 9,
    maxLength: 9
  },
  {
    code: 'SE',
    name: 'Sweden',
    dialCode: '+46',
    flag: '🇸🇪',
    minLength: 9,
    maxLength: 10
  },
  {
    code: 'NO',
    name: 'Norway',
    dialCode: '+47',
    flag: '🇳🇴',
    minLength: 8,
    maxLength: 8
  },
  {
    code: 'DK',
    name: 'Denmark',
    dialCode: '+45',
    flag: '🇩🇰',
    minLength: 8,
    maxLength: 8
  },
  {
    code: 'FI',
    name: 'Finland',
    dialCode: '+358',
    flag: '🇫🇮',
    minLength: 9,
    maxLength: 10
  }
]

export const getCountryByCode = (code: string): Country | undefined => {
  return countries.find(country => country.code === code)
}

export const getCountryByDialCode = (dialCode: string): Country | undefined => {
  return countries.find(country => country.dialCode === dialCode)
}

export const getDefaultCountry = (): Country => {
  return countries[0] // Default to India
}
