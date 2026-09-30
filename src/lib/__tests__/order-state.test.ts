import { canCancelOrder, canTransitionOrderStatus, hasShippingStarted } from '../order-state'

describe('order state rules', () => {
  it('blocks cancellation once shipping or fulfillment starts', () => {
    expect(hasShippingStarted('SHIPPED', 'UNFULFILLED')).toBe(true)
    expect(hasShippingStarted('PROCESSING', 'PARTIAL')).toBe(true)
    expect(canCancelOrder('PENDING', 'UNFULFILLED')).toBe(true)
    expect(canCancelOrder('DELIVERED', 'FULFILLED')).toBe(false)
  })

  it('allows only forward fulfillment transitions', () => {
    expect(canTransitionOrderStatus('PENDING', 'CONFIRMED')).toBe(true)
    expect(canTransitionOrderStatus('CONFIRMED', 'PROCESSING')).toBe(true)
    expect(canTransitionOrderStatus('SHIPPED', 'PROCESSING')).toBe(false)
    expect(canTransitionOrderStatus('DELIVERED', 'CANCELLED')).toBe(false)
  })
})
