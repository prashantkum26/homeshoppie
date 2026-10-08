// src/lib/emailValidation.ts

/**
 * Disposable / temporary email domains.
 *
 * This list can be extended whenever new disposable providers
 * need to be blocked.
 */
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  // Yopmail
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',

  // Mailinator
  'mailinator.com',
  'mailinator.net',
  'mailinator.org',

  // Temporary email
  '10minutemail.com',
  '10minutemail.net',
  '10minutemail.org',
  'temp-mail.org',
  'temp-mail.io',
  'tempmail.com',
  'tempmail.net',
  'tempmail.org',

  // Guerrilla Mail
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'sharklasers.com',
  'guerrillamail.info',
  'grr.la',

  // Trash / throwaway
  'trashmail.com',
  'trashmail.me',
  'trashmail.net',
  'trashmail.org',
  'throwawaymail.com',
  'throwawaymail.net',
  'dispostable.com',

  // Maildrop / disposable
  'maildrop.cc',
  'getnada.com',
  'mailnesia.com',
  'fakeinbox.com',
  'emailondeck.com',
  'mohmal.com',

  // Other temporary providers
  'tempr.email',
  'discard.email',
  'discardmail.com',
  'discardmail.de',
  'spambog.com',
  'spambog.de',
  'spamgourmet.com',
  'mytemp.email',
  'tempail.com',
  'tempmailo.com',
  'emailtemporanea.com',
  'temporary-mail.net',
])

/**
 * Basic email syntax validation.
 */
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

/**
 * Maximum length allowed by common email standards.
 */
const MAX_EMAIL_LENGTH = 254

export interface EmailValidationResult {
  isValid: boolean
  email: string
  domain: string
  error?: string
}

/**
 * Normalize an email address.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Extract domain from an email address.
 */
export function getEmailDomain(email: string): string {
  const normalizedEmail = normalizeEmail(email)
  const atIndex = normalizedEmail.lastIndexOf('@')

  if (atIndex === -1) {
    return ''
  }

  return normalizedEmail.substring(atIndex + 1)
}

/**
 * Check whether an email domain is disposable / temporary.
 */
export function isDisposableEmail(email: string): boolean {
  const domain = getEmailDomain(email)

  if (!domain) {
    return false
  }

  return DISPOSABLE_EMAIL_DOMAINS.has(domain)
}

/**
 * Validate email address.
 *
 * Checks:
 * - Required value
 * - Maximum length
 * - Basic email syntax
 * - Valid domain
 * - Disposable / temporary email providers
 */
export function validateEmail(email: unknown): EmailValidationResult {
  if (typeof email !== 'string') {
    return {
      isValid: false,
      email: '',
      domain: '',
      error: 'Email address is required',
    }
  }

  const normalizedEmail = normalizeEmail(email)

  if (!normalizedEmail) {
    return {
      isValid: false,
      email: '',
      domain: '',
      error: 'Email address is required',
    }
  }

  if (normalizedEmail.length > MAX_EMAIL_LENGTH) {
    return {
      isValid: false,
      email: normalizedEmail,
      domain: getEmailDomain(normalizedEmail),
      error: 'Email address is too long',
    }
  }

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return {
      isValid: false,
      email: normalizedEmail,
      domain: getEmailDomain(normalizedEmail),
      error: 'Please enter a valid email address',
    }
  }

  const domain = getEmailDomain(normalizedEmail)

  if (!domain || !domain.includes('.')) {
    return {
      isValid: false,
      email: normalizedEmail,
      domain,
      error: 'Please enter a valid email address',
    }
  }

  if (isDisposableEmail(normalizedEmail)) {
    return {
      isValid: false,
      email: normalizedEmail,
      domain,
      error: 'Temporary or disposable email addresses are not allowed',
    }
  }

  return {
    isValid: true,
    email: normalizedEmail,
    domain,
  }
}

/**
 * Simple boolean helper.
 */
export function isValidEmail(email: unknown): boolean {
  return validateEmail(email).isValid
}

/**
 * Get the disposable domain list.
 *
 * Useful if you want to inspect or extend the list elsewhere.
 */
export function getDisposableEmailDomains(): string[] {
  return Array.from(DISPOSABLE_EMAIL_DOMAINS)
}