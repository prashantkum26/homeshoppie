export type OrderState = 'DRAFT' | 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED'
export type FulfillmentState = 'UNFULFILLED' | 'PARTIAL' | 'FULFILLED' | 'CANCELLED'

export function hasShippingStarted(
  status: OrderState,
  fulfillmentStatus: FulfillmentState
): boolean {
  return (
    status === 'SHIPPED' ||
    status === 'DELIVERED' ||
    fulfillmentStatus === 'PARTIAL' ||
    fulfillmentStatus === 'FULFILLED'
  )
}

export function canCancelOrder(
  status: OrderState,
  fulfillmentStatus: FulfillmentState
): boolean {
  return !hasShippingStarted(status, fulfillmentStatus) &&
    !['CANCELLED', 'REFUNDED'].includes(status)
}

export function canTransitionOrderStatus(
  current: OrderState,
  next: OrderState
): boolean {
  if (current === next) return true
  if (current === 'DELIVERED' || current === 'REFUNDED') return false
  if (next === 'CANCELLED') return ['DRAFT', 'PENDING', 'CONFIRMED'].includes(current)
  if (next === 'REFUNDED') return current === 'CANCELLED'

  const transitions: Record<OrderState, OrderState[]> = {
    DRAFT: ['PENDING', 'CANCELLED'],
    PENDING: ['CONFIRMED', 'PROCESSING', 'CANCELLED'],
    CONFIRMED: ['PROCESSING', 'SHIPPED'],
    PROCESSING: ['SHIPPED'],
    SHIPPED: ['DELIVERED'],
    DELIVERED: [],
    CANCELLED: [],
    REFUNDED: [],
  }

  return transitions[current].includes(next)
}
