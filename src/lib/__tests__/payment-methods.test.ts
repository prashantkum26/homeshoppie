/**
 * @jest-environment node
 */

import type { PaymentMethod } from '@prisma/client'
import {
  getPaymentMethodAvailability,
  isPaymentMethodAvailable,
  isPaymentMethodValue,
  getAvailablePaymentMethods,
  getGatewayMethodRestriction,
  getPaymentMethodLabel,
  toPublicPaymentMethod,
  describePaymentMethodUnavailability,
} from '@/lib/payment-methods'

const ALL_ENUM_VALUES: PaymentMethod[] = ['card', 'upi', 'netbanking', 'wallet', 'emandate', 'nach']

describe('payment-methods catalogue', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      RAZORPAY_KEY_ID: 'rzp_test_key',
      RAZORPAY_KEY_SECRET: 'secret',
    }
    delete process.env.PAYMENT_METHODS_DISABLED
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  describe('isPaymentMethodValue', () => {
    it.each(ALL_ENUM_VALUES)('accepts the enum value %s', (value) => {
      expect(isPaymentMethodValue(value)).toBe(true)
    })

    it.each([['cod'], ['CARD'], [''], ['card ']])('rejects %s', (value) => {
      expect(isPaymentMethodValue(value)).toBe(false)
    })

    it('rejects non-string input', () => {
      expect(isPaymentMethodValue(null)).toBe(false)
      expect(isPaymentMethodValue(undefined)).toBe(false)
      expect(isPaymentMethodValue(1)).toBe(false)
      expect(isPaymentMethodValue({ value: 'card' })).toBe(false)
    })

    it('does not treat inherited Object properties as methods', () => {
      expect(isPaymentMethodValue('toString')).toBe(false)
      expect(isPaymentMethodValue('constructor')).toBe(false)
    })
  })

  describe('getPaymentMethodAvailability', () => {
    it('allows an enabled method within limits', () => {
      const result = getPaymentMethodAvailability('card', 1000)
      expect(result.available).toBe(true)
    })

    it('rejects an unknown method', () => {
      const result = getPaymentMethodAvailability('cod', 1000)
      expect(result).toEqual({ available: false, reason: 'UNKNOWN_METHOD' })
    })

    it('rejects a method that is disabled in the catalogue', () => {
      const result = getPaymentMethodAvailability('netbanking', 1000)
      expect(result.available).toBe(false)
      expect(result.available === false && result.reason).toBe('METHOD_DISABLED')
    })

    it('rejects a gateway method when Razorpay credentials are missing', () => {
      delete process.env.RAZORPAY_KEY_ID
      const result = getPaymentMethodAvailability('card', 1000)
      expect(result.available).toBe(false)
      expect(result.available === false && result.reason).toBe('GATEWAY_UNAVAILABLE')
    })

    it('rejects a gateway method when only the secret is missing', () => {
      delete process.env.RAZORPAY_KEY_SECRET
      expect(isPaymentMethodAvailable('card', 1000)).toBe(false)
    })

    it('rejects an amount above the UPI ceiling', () => {
      const result = getPaymentMethodAvailability('upi', 100001)
      expect(result.available).toBe(false)
      expect(result.available === false && result.reason).toBe('AMOUNT_ABOVE_MAXIMUM')
    })

    it('allows an amount exactly at the UPI ceiling', () => {
      expect(isPaymentMethodAvailable('upi', 100000)).toBe(true)
    })

    it('rejects an amount below the minimum', () => {
      const result = getPaymentMethodAvailability('card', 0)
      expect(result.available).toBe(false)
      expect(result.available === false && result.reason).toBe('AMOUNT_BELOW_MINIMUM')
    })

    it('skips amount checks when no amount is supplied', () => {
      expect(isPaymentMethodAvailable('upi')).toBe(true)
      expect(isPaymentMethodAvailable('upi', null)).toBe(true)
    })

    it('skips amount checks for a non-finite amount', () => {
      expect(isPaymentMethodAvailable('upi', Number.NaN)).toBe(true)
      expect(isPaymentMethodAvailable('upi', Number.POSITIVE_INFINITY)).toBe(true)
    })

    it('checks the disabled flag before the gateway and amount', () => {
      delete process.env.RAZORPAY_KEY_ID
      const result = getPaymentMethodAvailability('netbanking', 999999)
      expect(result.available === false && result.reason).toBe('METHOD_DISABLED')
    })
  })

  describe('PAYMENT_METHODS_DISABLED override', () => {
    it('disables a method listed in the env var', () => {
      process.env.PAYMENT_METHODS_DISABLED = 'upi'
      expect(isPaymentMethodAvailable('upi', 500)).toBe(false)
      expect(isPaymentMethodAvailable('card', 500)).toBe(true)
    })

    it('handles whitespace, casing and multiple entries', () => {
      process.env.PAYMENT_METHODS_DISABLED = ' UPI , card '
      expect(isPaymentMethodAvailable('upi', 500)).toBe(false)
      expect(isPaymentMethodAvailable('card', 500)).toBe(false)
    })

    it('ignores unknown entries rather than breaking checkout', () => {
      process.env.PAYMENT_METHODS_DISABLED = 'bogus,,upi'
      expect(isPaymentMethodAvailable('card', 500)).toBe(true)
      expect(isPaymentMethodAvailable('upi', 500)).toBe(false)
    })

    it('is read at call time so it can change without a restart', () => {
      expect(isPaymentMethodAvailable('card', 500)).toBe(true)
      process.env.PAYMENT_METHODS_DISABLED = 'card'
      expect(isPaymentMethodAvailable('card', 500)).toBe(false)
    })
  })

  describe('getAvailablePaymentMethods', () => {
    it('returns only enabled methods, sorted', () => {
      const methods = getAvailablePaymentMethods(1000).map((m) => m.value)
      expect(methods).toEqual(['card', 'upi'])
    })

    it('drops a method whose limit the amount exceeds', () => {
      const methods = getAvailablePaymentMethods(200000).map((m) => m.value)
      expect(methods).toEqual(['card'])
    })

    it('returns an empty list when the gateway is unconfigured', () => {
      delete process.env.RAZORPAY_KEY_ID
      delete process.env.RAZORPAY_KEY_SECRET
      expect(getAvailablePaymentMethods(1000)).toEqual([])
    })

    it('agrees with the single-method check for every enum value', () => {
      const available = getAvailablePaymentMethods(1000).map((m) => m.value)

      for (const method of ALL_ENUM_VALUES) {
        expect(available.includes(method)).toBe(isPaymentMethodAvailable(method, 1000))
      }
    })
  })

  describe('toPublicPaymentMethod', () => {
    it('exposes only client-safe fields', () => {
      const [card] = getAvailablePaymentMethods(1000)
      expect(Object.keys(toPublicPaymentMethod(card)).sort()).toEqual([
        'description',
        'label',
        'value',
      ])
    })

    it('does not leak gateway or limit configuration', () => {
      const [card] = getAvailablePaymentMethods(1000)
      const serialized = JSON.stringify(toPublicPaymentMethod(card))
      expect(serialized).not.toContain('gatewayMethodRestriction')
      expect(serialized).not.toContain('maxAmount')
      expect(serialized).not.toContain('enabled')
    })
  })

  describe('getGatewayMethodRestriction', () => {
    it('returns the gateway method for a normal method', () => {
      expect(getGatewayMethodRestriction('card')).toBe('card')
      expect(getGatewayMethodRestriction('upi')).toBe('upi')
    })

    it('returns undefined for wallet, which Razorpay rejects as a restriction', () => {
      expect(getGatewayMethodRestriction('wallet')).toBeUndefined()
    })

    it('returns undefined for an unknown method', () => {
      expect(getGatewayMethodRestriction('cod')).toBeUndefined()
      expect(getGatewayMethodRestriction(null)).toBeUndefined()
    })
  })

  describe('labels and messages', () => {
    it('labels a known method', () => {
      expect(getPaymentMethodLabel('upi')).toBe('UPI Payment')
    })

    it('falls back for an unknown method', () => {
      expect(getPaymentMethodLabel('cod')).toBe('Unknown')
    })

    it('has a message for every unavailability reason', () => {
      const reasons = [
        'UNKNOWN_METHOD',
        'METHOD_DISABLED',
        'GATEWAY_UNAVAILABLE',
        'AMOUNT_BELOW_MINIMUM',
        'AMOUNT_ABOVE_MAXIMUM',
      ] as const

      for (const reason of reasons) {
        expect(describePaymentMethodUnavailability(reason)).toEqual(expect.any(String))
        expect(describePaymentMethodUnavailability(reason).length).toBeGreaterThan(0)
      }
    })
  })
})
