import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getLatePaymentRefundReceipt,
  processLatePaymentRefund,
  verifyWebhookSignature,
} from "@/lib/razorpay";
import { logSecurityEvent, getClientIP } from "@/lib/security";

function getPaymentGatewaySnapshot(paymentEntity: Record<string, unknown>) {
  return {
    id: typeof paymentEntity.id === 'string' ? paymentEntity.id : undefined,
    order_id: typeof paymentEntity.order_id === 'string' ? paymentEntity.order_id : undefined,
    amount: typeof paymentEntity.amount === 'number' ? paymentEntity.amount : undefined,
    currency: typeof paymentEntity.currency === 'string' ? paymentEntity.currency : undefined,
    status: typeof paymentEntity.status === 'string' ? paymentEntity.status : undefined,
    method: typeof paymentEntity.method === 'string' ? paymentEntity.method : undefined,
    error_code: typeof paymentEntity.error_code === 'string' ? paymentEntity.error_code : undefined,
    error_description: typeof paymentEntity.error_description === 'string'
      ? paymentEntity.error_description
      : undefined,
  };
}

function getOrderGatewaySnapshot(orderEntity: Record<string, unknown>) {
  return {
    id: typeof orderEntity.id === 'string' ? orderEntity.id : undefined,
    amount_paid: typeof orderEntity.amount_paid === 'number' ? orderEntity.amount_paid : undefined,
    currency: typeof orderEntity.currency === 'string' ? orderEntity.currency : undefined,
    status: typeof orderEntity.status === 'string' ? orderEntity.status : undefined,
  };
}

export async function POST(req: NextRequest) {
  const ipAddress = getClientIP(req);
  
  try {
    // Get raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    if (!signature) {
      await logSecurityEvent({
        action: 'UNAUTHORIZED_ACCESS',
        ipAddress,
        severity: 'HIGH',
        details: { 
          endpoint: '/api/razorpay/webhook', 
          reason: 'Missing webhook signature'
        },
        blocked: true
      });
      
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      );
    }

    // Verify webhook signature
    const isValidSignature = verifyWebhookSignature(body, signature);
    if (!isValidSignature) {
      await logSecurityEvent({
        action: 'UNAUTHORIZED_ACCESS',
        ipAddress,
        severity: 'CRITICAL',
        details: { 
          endpoint: '/api/razorpay/webhook', 
          reason: 'Invalid webhook signature',
          provided_signature: signature.substring(0, 20) + '...' // Log partial for security
        },
        blocked: true
      });
      
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse the webhook payload
    const event = JSON.parse(body);
    const { event: eventType, payload } = event;

    // Log webhook received
    await logSecurityEvent({
      action: 'API_ACCESS',
      ipAddress,
      severity: 'LOW',
      details: {
        endpoint: '/api/razorpay/webhook',
        action: 'webhook_received',
        event_type: eventType,
        entity_id: payload?.payment?.entity?.id || payload?.order?.entity?.id
      }
    });

    // Handle different webhook events
    switch (eventType) {
      case 'payment.authorized':
        await handlePaymentSuccess(payload.payment.entity, false);
        break;

      case 'payment.captured':
        await handlePaymentSuccess(payload.payment.entity, true);
        break;
        
      case 'payment.failed':
        await handlePaymentFailure(payload.payment.entity);
        break;
        
      case 'order.paid':
        await handleOrderPaid(payload.order.entity);
        break;
        
      default:
        // Log unknown event types for monitoring
        await logSecurityEvent({
          action: 'API_ACCESS',
          ipAddress,
          severity: 'LOW',
          details: {
            endpoint: '/api/razorpay/webhook',
            action: 'unknown_event_type',
            event_type: eventType
          }
        });
        break;
    }

    return NextResponse.json({ status: 'success' });

  } catch (error: any) {
    console.error('Webhook processing failed:', error instanceof Error ? error.message : 'unknown error');
    
    await logSecurityEvent({
      action: 'API_ACCESS',
      ipAddress,
      severity: 'HIGH',
      details: {
        endpoint: '/api/razorpay/webhook',
        action: 'webhook_processing_failed'
      }
    });

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handlePaymentSuccess(paymentEntity: any, captured: boolean) {
  try {
    const {
      id: paymentId,
      order_id: razorpayOrderId,
      amount,
      currency,
      method,
    } = paymentEntity;

    // Find payment log
    const paymentLog = await prisma.paymentLog.findFirst({
      where: { razorpayOrderId },
      include: { order: { include: { orderItems: true } } }
    });

    if (!paymentLog) {
      console.error('Payment log not found for Razorpay order');
      return;
    }

    if (
      paymentLog.amount !== amount ||
      paymentLog.currency !== currency ||
      !razorpayOrderId ||
      typeof paymentId !== 'string' ||
      !Number.isSafeInteger(amount) ||
      amount <= 0
    ) {
      await logSecurityEvent({
        action: 'SUSPICIOUS_ACTIVITY',
        ipAddress: 'webhook',
        severity: 'CRITICAL',
        details: {
          endpoint: '/api/razorpay/webhook',
          action: 'payment_amount_or_currency_mismatch',
          payment_id: paymentId,
          razorpay_order_id: razorpayOrderId,
          order_id: paymentLog.orderId,
        },
        blocked: true,
      });
      return;
    }

    if (
      paymentLog.razorpayPaymentId === paymentId &&
      captured &&
      paymentLog.refundStatus !== 'NOT_REQUIRED' &&
      paymentLog.refundStatus !== 'SUCCEEDED'
    ) {
      await processLatePaymentRefund(paymentLog.id);
      return;
    }

    // Check if this payment has already been processed (idempotency check)
    if (
      paymentLog.razorpayPaymentId === paymentId &&
      ['PAID', 'REFUNDED'].includes(paymentLog.status)
    ) {
      return;
    }

    // Enhanced duplicate checking for razorpayPaymentId
    if (paymentId) {
      const existingPaymentWithId = await prisma.paymentLog.findFirst({
        where: {
          razorpayPaymentId: paymentId,
          id: { not: paymentLog.id }
        }
      });

      if (existingPaymentWithId) {
        console.warn('Razorpay payment ID already exists in another record');
        await logSecurityEvent({
          action: 'API_ACCESS',
          ipAddress: 'webhook',
          severity: 'HIGH',
          details: {
            endpoint: '/api/razorpay/webhook',
            action: 'duplicate_payment_id_blocked',
            payment_id: paymentId,
            existing_log_id: existingPaymentWithId.id,
            current_log_id: paymentLog.id,
            reason: 'Payment ID uniqueness violation prevented'
          }
        });
        return; // Block duplicate payment processing
      }
    }

    // Map Razorpay method to our internal method
    let internalMethod = paymentLog.order.paymentMethod; // Keep original if mapping fails
    if (method) {
      switch (method.toLowerCase()) {
        case 'card':
          internalMethod = 'card';
          break;
        case 'upi':
          internalMethod = 'upi';
          break;
        case 'netbanking':
          internalMethod = 'netbanking';
          break;
        case 'wallet':
          internalMethod = 'wallet';
          break;
        default:
          // Unknown/unsupported method – keep original enum value
          break;
      }
    }

    // Transition active orders normally. A captured payment that loses a race
    // with cancellation is recorded for refund without changing order status.
    try {
      const transition = await prisma.$transaction(async (tx) => {
        const orderUpdate = await tx.order.updateMany({
          where: captured
            ? {
                id: paymentLog.orderId,
                status: 'PENDING',
                paymentStatus: { in: ['PENDING', 'AUTHORIZED'] },
              }
            : {
                id: paymentLog.orderId,
                status: 'PENDING',
                paymentStatus: 'PENDING',
              },
          data: captured
            ? {
                paymentStatus: 'PAID',
                paymentMethod: internalMethod,
                status: 'CONFIRMED',
                paymentIntentId: paymentId,
                updatedAt: new Date(),
              }
            : {
                paymentStatus: 'AUTHORIZED',
                paymentMethod: internalMethod,
                paymentIntentId: paymentId,
                updatedAt: new Date(),
              },
        });

        if (orderUpdate.count === 1) {
          const paymentUpdate = await tx.paymentLog.updateMany({
            where: {
              id: paymentLog.id,
              status: { in: ['PENDING', 'AUTHORIZED'] },
              OR: [
                { razorpayPaymentId: null },
                { razorpayPaymentId: paymentId },
              ],
            },
            data: {
              status: captured ? 'PAID' : 'AUTHORIZED',
              razorpayPaymentId: paymentId,
              method,
              gatewayResponse: getPaymentGatewaySnapshot(paymentEntity),
              updatedAt: new Date(),
            },
          });

          if (paymentUpdate.count !== 1) {
            throw new Error('Payment log transition conflicted with order transition');
          }

          return {
            orderUpdated: true,
            paymentUpdated: true,
            refundPaymentLogId: null,
          };
        }

        const currentOrder = await tx.order.findUnique({
          where: { id: paymentLog.orderId },
          select: {
            status: true,
            paymentStatus: true,
            cancelledAt: true,
          },
        });
        const isTerminalOrder =
          currentOrder?.status === 'CANCELLED' ||
          currentOrder?.cancelledAt != null ||
          currentOrder?.paymentStatus === 'FAILED' ||
          currentOrder?.paymentStatus === 'CANCELLED';

        if (!captured || !isTerminalOrder) {
          return {
            orderUpdated: false,
            paymentUpdated: false,
            refundPaymentLogId: null,
          };
        }

        const refundRequestedAt = new Date();
        if (currentOrder?.cancelledAt) {
          await tx.order.updateMany({
            where: {
              id: paymentLog.orderId,
              cancelledAt: { not: null },
            },
            data: {
              status: 'CANCELLED',
              updatedAt: refundRequestedAt,
            },
          });
        }

        const latePaymentUpdate = await tx.paymentLog.updateMany({
          where: {
            id: paymentLog.id,
            refundStatus: 'NOT_REQUIRED',
            status: {
              in: ['PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED'],
            },
            OR: [
              { razorpayPaymentId: null },
              { razorpayPaymentId: paymentId },
            ],
          },
          data: {
            status: 'PAID',
            razorpayPaymentId: paymentId,
            method,
            gatewayResponse: getPaymentGatewaySnapshot(paymentEntity),
            refundStatus: 'PENDING',
            refundAmount: amount,
            refundReceipt: getLatePaymentRefundReceipt(paymentLog.id),
            refundRequestedAt,
            refundFailureReason: null,
            updatedAt: refundRequestedAt,
          },
        });

        return {
          orderUpdated: false,
          paymentUpdated: latePaymentUpdate.count === 1,
          refundPaymentLogId:
            latePaymentUpdate.count === 1 ? paymentLog.id : null,
        };
      });

      if (transition.refundPaymentLogId) {
        const refund = await processLatePaymentRefund(
          transition.refundPaymentLogId
        );
        await logSecurityEvent({
          action: 'API_ACCESS',
          ipAddress: 'webhook',
          severity: refund.status === 'FAILED' ? 'HIGH' : 'MEDIUM',
          details: {
            endpoint: '/api/razorpay/webhook',
            action: 'late_payment_refund_reconciled',
            payment_id: paymentId,
            order_id: paymentLog.orderId,
            refund_id: refund.refundId,
            refund_status: refund.status,
            refund_amount: amount,
          },
        });
        return;
      }

      if (!transition.paymentUpdated) {
        await logSecurityEvent({
          action: 'API_ACCESS',
          ipAddress: 'webhook',
          severity: 'HIGH',
          details: {
            endpoint: '/api/razorpay/webhook',
            action: 'payment_received_for_non_pending_order',
            payment_id: paymentId,
            order_id: paymentLog.orderId,
            captured,
            reconciliation_required: captured,
          },
        });
        return;
      }
    } catch (dbError: any) {
      // Handle unique constraint violation specifically
      if (dbError.code === 'P2002' && dbError.meta?.target?.includes('razorpayPaymentId')) {
        console.warn('Duplicate Razorpay payment ID constraint violation handled');
        
        await logSecurityEvent({
          action: 'API_ACCESS',
          ipAddress: 'webhook',
          severity: 'MEDIUM',
          details: {
            endpoint: '/api/razorpay/webhook',
            action: 'duplicate_constraint_handled',
            payment_id: paymentId,
            order_id: paymentLog.orderId
          }
        });
        return; // Gracefully handle the duplicate
      }
      throw dbError; // Re-throw other database errors
    }

    // Log successful payment processing
    await logSecurityEvent({
      action: 'API_ACCESS',
      ipAddress: 'webhook',
      severity: 'LOW',
      details: {
        endpoint: '/api/razorpay/webhook',
        action: 'payment_success_processed',
        payment_id: paymentId,
        order_id: paymentLog.orderId,
        amount: amount / 100 // Convert from paise
      }
    });

  } catch (error: any) {
    console.error('Failed to process payment success:', error instanceof Error ? error.message : 'unknown error');
    throw error;
  }
}

async function handlePaymentFailure(paymentEntity: any) {
  try {
    const { id: paymentId, order_id: razorpayOrderId, error_code, error_description } = paymentEntity;

    // Find payment log
    const paymentLog = await prisma.paymentLog.findFirst({
      where: { razorpayOrderId },
      include: { order: { include: { orderItems: true } } }
    });

    if (!paymentLog) {
      console.error('Payment log not found for Razorpay order');
      return;
    }

    // Check if this payment failure has already been processed (idempotency check)
    if (paymentLog.razorpayPaymentId === paymentId && paymentLog.status === 'FAILED') {
      return;
    }

    // Check if this razorpayPaymentId already exists in another record
    const existingPaymentWithId = await prisma.paymentLog.findFirst({
      where: {
        razorpayPaymentId: paymentId,
        id: { not: paymentLog.id }
      }
    });

    if (existingPaymentWithId) {
      console.warn('Razorpay payment ID already exists in another record');
      await logSecurityEvent({
        action: 'API_ACCESS',
        ipAddress: 'webhook',
        severity: 'MEDIUM',
        details: {
          endpoint: '/api/razorpay/webhook',
          action: 'duplicate_payment_id_detected_failure',
          payment_id: paymentId,
          existing_log_id: existingPaymentWithId.id,
          current_log_id: paymentLog.id
        }
      });
      return;
    }

    // Update payment log with failure details and release stock only when this
    // was the final active payment attempt.
    try {
      await prisma.$transaction(async (tx) => {
        // Update payment log with failure
        const updateResult = await tx.paymentLog.updateMany({
          where: {
            id: paymentLog.id,
            status: { not: 'PAID' },
          },
          data: {
            status: 'FAILED',
            razorpayPaymentId: paymentId,
            failureReason: `${error_code}: ${error_description}`,
            gatewayResponse: getPaymentGatewaySnapshot(paymentEntity),
            retryCount: { increment: 1 },
            updatedAt: new Date()
          }
        });

        if (updateResult.count === 0) {
          return;
        }

        const activeAttempts = await tx.paymentLog.count({
          where: {
            orderId: paymentLog.orderId,
            id: { not: paymentLog.id },
            status: { in: ['PENDING', 'AUTHORIZED'] },
          },
        });

        if (activeAttempts === 0) {
          const orderUpdate = await tx.order.updateMany({
            where: {
              id: paymentLog.orderId,
              paymentStatus: { not: 'PAID' },
              status: 'PENDING',
            },
            data: {
              status: 'CANCELLED',
              paymentStatus: 'FAILED',
              updatedAt: new Date()
            }
          });

          if (orderUpdate.count === 1) {
            for (const item of paymentLog.order.orderItems) {
              await tx.product.updateMany({
                where: { id: item.productId },
                data: { stock: { increment: item.quantity } },
              });
            }
          }
        }
      });
    } catch (dbError: any) {
      // Handle unique constraint violation specifically
      if (dbError.code === 'P2002' && dbError.meta?.target?.includes('razorpayPaymentId')) {
        console.warn('Duplicate Razorpay payment ID constraint violation handled for failure');
        
        await logSecurityEvent({
          action: 'API_ACCESS',
          ipAddress: 'webhook',
          severity: 'MEDIUM',
          details: {
            endpoint: '/api/razorpay/webhook',
            action: 'duplicate_constraint_handled_failure',
            payment_id: paymentId,
            order_id: paymentLog.orderId
          }
        });
        return; // Gracefully handle the duplicate
      }
      throw dbError; // Re-throw other database errors
    }

    // Log payment failure
    await logSecurityEvent({
      action: 'API_ACCESS',
      ipAddress: 'webhook',
      severity: 'MEDIUM',
      details: {
        endpoint: '/api/razorpay/webhook',
        action: 'payment_failure_processed',
        payment_id: paymentId,
        order_id: paymentLog.orderId,
        error_code,
        error_description
      }
    });

  } catch (error: any) {
    console.error('Failed to process payment failure:', error instanceof Error ? error.message : 'unknown error');
    throw error;
  }
}

async function handleOrderPaid(orderEntity: any) {
  try {
    const { id: razorpayOrderId, amount_paid, status } = orderEntity;

    // Find payment log
    const paymentLog = await prisma.paymentLog.findFirst({
      where: { razorpayOrderId },
      include: { order: true }
    });

    if (!paymentLog) {
      console.error('Payment log not found for Razorpay order');
      return;
    }

    // Double-check that the order is fully paid
    if (
      status === 'paid' &&
      amount_paid === paymentLog.amount &&
      orderEntity.currency === paymentLog.currency
    ) {
      const transition = await prisma.$transaction(async (tx) => {
        const orderUpdate = await tx.order.updateMany({
          where: {
            id: paymentLog.orderId,
            status: 'PENDING',
            paymentStatus: { in: ['PENDING', 'AUTHORIZED'] },
          },
          data: {
            paymentStatus: 'PAID',
            status: 'CONFIRMED',
            updatedAt: new Date(),
          },
        });

        const paymentUpdate = await tx.paymentLog.updateMany({
          where: {
            id: paymentLog.id,
            status: { in: ['PENDING', 'AUTHORIZED'] },
          },
          data: {
            status: 'PAID',
            gatewayResponse: getOrderGatewaySnapshot(orderEntity),
            updatedAt: new Date(),
          },
        });

        return {
          orderUpdated: orderUpdate.count === 1,
          paymentUpdated: paymentUpdate.count === 1,
        };
      });

      if (!transition.orderUpdated) {
        if (paymentLog.order.status === 'CANCELLED') {
          const latePayment = await prisma.paymentLog.updateMany({
            where: {
              id: paymentLog.id,
              refundStatus: 'NOT_REQUIRED',
              status: { in: ['PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED'] },
            },
            data: {
              status: 'PAID',
              refundStatus: 'PENDING',
              refundAmount: amount_paid,
              refundReceipt: getLatePaymentRefundReceipt(paymentLog.id),
              refundRequestedAt: new Date(),
              refundFailureReason: null,
              updatedAt: new Date(),
            },
          });

          if (latePayment.count === 1) {
            const refund = await processLatePaymentRefund(paymentLog.id);
            await logSecurityEvent({
              action: 'API_ACCESS',
              ipAddress: 'webhook',
              severity: refund.status === 'FAILED' ? 'HIGH' : 'MEDIUM',
              details: {
                endpoint: '/api/razorpay/webhook',
                action: 'late_order_paid_refund_reconciled',
                order_id: paymentLog.orderId,
                refund_status: refund.status,
                refund_amount: amount_paid,
              },
            });
          }
          return;
        }

        if (!transition.paymentUpdated) return;

        await logSecurityEvent({
          action: 'API_ACCESS',
          ipAddress: 'webhook',
          severity: 'HIGH',
          details: {
            endpoint: '/api/razorpay/webhook',
            action: 'order_paid_for_non_pending_order',
            razorpay_order_id: razorpayOrderId,
            order_id: paymentLog.orderId,
            reconciliation_required: true,
          },
        });
        return;
      }

      // Log order paid processing
      await logSecurityEvent({
        action: 'API_ACCESS',
        ipAddress: 'webhook',
        severity: 'LOW',
        details: {
          endpoint: '/api/razorpay/webhook',
          action: 'order_paid_processed',
          razorpay_order_id: razorpayOrderId,
          order_id: paymentLog.orderId,
          amount_paid: amount_paid / 100
        }
      });
    }

  } catch (error: any) {
    console.error('Failed to process order paid:', error instanceof Error ? error.message : 'unknown error');
    throw error;
  }
}
