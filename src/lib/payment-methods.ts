import type { PaymentMethod } from '@prisma/client'

/**
 * Single source of truth for which payment methods customers may use.
 *
 * Every consumer (checkout UI, order creation, gateway order creation) must
 * resolve availability through this module so the list can never drift.
 *
 * The catalogue is typed as a total record over the Prisma `PaymentMethod`
 * enum: adding a value to the enum fails type-check until it is described
 * here, which makes the compiler the synchronisation mechanism.
 */

/**
 * Methods Razorpay accepts as an order-level `method` restriction.
 * Deliberately excludes `wallet`, which the gateway rejects there.
 */
export type GatewayMethodRestriction = 'netbanking' | 'upi' | 'card' | 'emandate' | 'nach'

export type PaymentMethodDefinition = {
  /** Enum value persisted on `Order.paymentMethod`. */
  value: PaymentMethod
  label: string
  description: string
  /** Display order in the checkout UI (ascending). */
  sortOrder: number
  /** Whether the method is offered at all, before env overrides. */
  enabled: boolean
  /** Requires a configured payment gateway to be usable. */
  requiresGateway: boolean
  /** Inclusive minimum order total in rupees, or null for no floor. */
  minAmount: number | null
  /** Inclusive maximum order total in rupees, or null for no ceiling. */
  maxAmount: number | null
  /**
   * Value passed to Razorpay's order-creation `method` restriction.
   * `null` means "do not restrict" — Razorpay rejects some enum values
   * (notably `wallet`) as an order-level restriction.
   */
  gatewayMethodRestriction: GatewayMethodRestriction | null
}

/**
 * UPI transactions are capped by NPCI/bank limits. Keeping the ceiling here
 * means a high-value cart never reaches the Razorpay modal with a method
 * that is guaranteed to fail.
 */
const UPI_MAX_AMOUNT = 100000

const PAYMENT_METHOD_CATALOGUE: Record<PaymentMethod, PaymentMethodDefinition> = {
  card: {
    value: 'card',
    label: 'Credit/Debit Card',
    description: 'Visa, Mastercard, RuPay, American Express',
    sortOrder: 10,
    enabled: true,
    requiresGateway: true,
    minAmount: 1,
    maxAmount: null,
    gatewayMethodRestriction: 'card',
  },
  upi: {
    value: 'upi',
    label: 'UPI Payment',
    description: 'Google Pay, PhonePe, Paytm, BHIM and other UPI apps',
    sortOrder: 20,
    enabled: true,
    requiresGateway: true,
    minAmount: 1,
    maxAmount: UPI_MAX_AMOUNT,
    gatewayMethodRestriction: 'upi',
  },
  netbanking: {
    value: 'netbanking',
    label: 'Net Banking',
    description: 'Pay directly from your bank account',
    sortOrder: 30,
    enabled: false,
    requiresGateway: true,
    minAmount: 1,
    maxAmount: null,
    gatewayMethodRestriction: 'netbanking',
  },
  wallet: {
    value: 'wallet',
    label: 'Wallet',
    description: 'Pay using a supported digital wallet',
    sortOrder: 40,
    enabled: false,
    requiresGateway: true,
    minAmount: 1,
    maxAmount: null,
    // Razorpay does not accept "wallet" as an order-level method restriction.
    gatewayMethodRestriction: null,
  },
  emandate: {
    value: 'emandate',
    label: 'e-Mandate',
    description: 'Recurring bank mandate',
    sortOrder: 50,
    enabled: false,
    requiresGateway: true,
    minAmount: 1,
    maxAmount: null,
    gatewayMethodRestriction: 'emandate',
  },
  nach: {
    value: 'nach',
    label: 'NACH',
    description: 'Recurring NACH mandate',
    sortOrder: 60,
    enabled: false,
    requiresGateway: true,
    minAmount: 1,
    maxAmount: null,
    gatewayMethodRestriction: 'nach',
  },
}

const ALL_PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_CATALOGUE) as PaymentMethod[]

export function isPaymentMethodValue(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PAYMENT_METHOD_CATALOGUE, value)
}

/**
 * Parses `PAYMENT_METHODS_DISABLED` — a comma-separated list of enum values
 * that operations can switch off without a deploy. Unknown entries are
 * ignored rather than throwing, so a typo cannot take checkout down.
 */
function getEnvDisabledMethods(): Set<PaymentMethod> {
  const raw = process.env.PAYMENT_METHODS_DISABLED

  if (!raw) return new Set()

  const disabled = new Set<PaymentMethod>()

  for (const entry of raw.split(',')) {
    const candidate = entry.trim().toLowerCase()
    if (isPaymentMethodValue(candidate)) {
      disabled.add(candidate)
    }
  }

  return disabled
}

/** A gateway-backed method is unusable unless Razorpay credentials exist. */
function isGatewayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
}

export type PaymentMethodUnavailableReason =
  | 'UNKNOWN_METHOD'
  | 'METHOD_DISABLED'
  | 'GATEWAY_UNAVAILABLE'
  | 'AMOUNT_BELOW_MINIMUM'
  | 'AMOUNT_ABOVE_MAXIMUM'

export type PaymentMethodAvailability =
  | { available: true; definition: PaymentMethodDefinition }
  | { available: false; reason: PaymentMethodUnavailableReason; definition?: PaymentMethodDefinition }

/**
 * Authoritative availability check.
 *
 * `amount` is the order total in rupees. Callers on the server must pass the
 * server-computed total, never a client-supplied one.
 */
export function getPaymentMethodAvailability(
  method: unknown,
  amount?: number | null
): PaymentMethodAvailability {
  if (!isPaymentMethodValue(method)) {
    return { available: false, reason: 'UNKNOWN_METHOD' }
  }

  const definition = PAYMENT_METHOD_CATALOGUE[method]

  if (!definition.enabled || getEnvDisabledMethods().has(method)) {
    return { available: false, reason: 'METHOD_DISABLED', definition }
  }

  if (definition.requiresGateway && !isGatewayConfigured()) {
    return { available: false, reason: 'GATEWAY_UNAVAILABLE', definition }
  }

  if (typeof amount === 'number' && Number.isFinite(amount)) {
    if (definition.minAmount !== null && amount < definition.minAmount) {
      return { available: false, reason: 'AMOUNT_BELOW_MINIMUM', definition }
    }

    if (definition.maxAmount !== null && amount > definition.maxAmount) {
      return { available: false, reason: 'AMOUNT_ABOVE_MAXIMUM', definition }
    }
  }

  return { available: true, definition }
}

export function isPaymentMethodAvailable(method: unknown, amount?: number | null): boolean {
  return getPaymentMethodAvailability(method, amount).available
}

/** Every method currently offerable, sorted for display. */
export function getAvailablePaymentMethods(amount?: number | null): PaymentMethodDefinition[] {
  return ALL_PAYMENT_METHODS
    .map((method) => getPaymentMethodAvailability(method, amount))
    .filter((result): result is { available: true; definition: PaymentMethodDefinition } => result.available)
    .map((result) => result.definition)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

/** Client-safe projection — omits gateway wiring details. */
export type PublicPaymentMethod = Pick<
  PaymentMethodDefinition,
  'value' | 'label' | 'description'
>

export function toPublicPaymentMethod(definition: PaymentMethodDefinition): PublicPaymentMethod {
  return {
    value: definition.value,
    label: definition.label,
    description: definition.description,
  }
}

/**
 * Gateway `method` restriction for an order, or `undefined` when the order
 * must not be restricted. Keeps gateway quirks out of the route handlers.
 */
export function getGatewayMethodRestriction(method: unknown): GatewayMethodRestriction | undefined {
  if (!isPaymentMethodValue(method)) return undefined

  return PAYMENT_METHOD_CATALOGUE[method].gatewayMethodRestriction ?? undefined
}

export function getPaymentMethodLabel(method: unknown): string {
  if (!isPaymentMethodValue(method)) return 'Unknown'

  return PAYMENT_METHOD_CATALOGUE[method].label
}

export const PAYMENT_METHOD_UNAVAILABLE_MESSAGES: Record<PaymentMethodUnavailableReason, string> = {
  UNKNOWN_METHOD: 'Invalid payment method',
  METHOD_DISABLED: 'This payment method is currently unavailable',
  GATEWAY_UNAVAILABLE: 'Online payments are temporarily unavailable. Please try again later.',
  AMOUNT_BELOW_MINIMUM: 'Your order total is below the minimum for this payment method',
  AMOUNT_ABOVE_MAXIMUM: 'Your order total exceeds the limit for this payment method',
}

export function describePaymentMethodUnavailability(reason: PaymentMethodUnavailableReason): string {
  return PAYMENT_METHOD_UNAVAILABLE_MESSAGES[reason]
}
