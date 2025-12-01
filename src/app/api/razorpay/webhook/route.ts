import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature, RAZORPAY_CONFIG } from "@/lib/razorpay";
import { logSecurityEvent, getClientIP } from "@/lib/security";

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
      case 'payment.captured':
        await handlePaymentSuccess(payload.payment.entity);
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
    console.error('Webhook processing failed:', error);
    
    await logSecurityEvent({
      action: 'API_ACCESS',
      ipAddress,
      severity: 'HIGH',
      details: {
        endpoint: '/api/razorpay/webhook',
        error: error.message,
        action: 'webhook_processing_failed'
      }
    });

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handlePaymentSuccess(paymentEntity: any) {
  try {
    const { id: paymentId, order_id: razorpayOrderId, amount, status, method } = paymentEntity;

    // Find payment log
    const paymentLog = await prisma.paymentLog.findFirst({
      where: { razorpayOrderId },
      include: { order: true }
    });

    if (!paymentLog) {
      console.error('Payment log not found for Razorpay order:', razorpayOrderId);
      return;
    }

    // Check if this payment has already been processed (idempotency check)
    if (paymentLog.razorpayPaymentId === paymentId && paymentLog.status === 'PAID') {
      console.log('Payment already processed:', paymentId);
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
      console.warn('RazorpayPaymentId already exists in another record:', paymentId);
      // Log the duplicate attempt but don't throw error
      await logSecurityEvent({
        action: 'API_ACCESS',
        ipAddress: 'webhook',
        severity: 'MEDIUM',
        details: {
          endpoint: '/api/razorpay/webhook',
          action: 'duplicate_payment_id_detected',
          payment_id: paymentId,
          existing_log_id: existingPaymentWithId.id,
          current_log_id: paymentLog.id
        }
      });
      return;
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
          internalMethod = method.toLowerCase();
      }
    }

    // Update payment log and order status with error handling
    try {
      await prisma.$transaction(async (tx) => {
        // Use updateMany with where clause to avoid unique constraint issues
        const updateResult = await tx.paymentLog.updateMany({
          where: {
            id: paymentLog.id,
            OR: [
              { razorpayPaymentId: null },
              { razorpayPaymentId: paymentId } // Allow updating same payment ID
            ]
          },
          data: {
            status: 'PAID',
            razorpayPaymentId: paymentId,
            method: method,
            gatewayResponse: paymentEntity,
            updatedAt: new Date()
          }
        });

        // If no rows were updated, payment ID might already be set by another process
        if (updateResult.count === 0) {
          console.warn('Payment log not updated - possibly already processed by another request:', paymentId);
          return;
        }

        await tx.order.update({
          where: { id: paymentLog.orderId },
          data: {
            paymentStatus: 'PAID',
            paymentMethod: internalMethod,
            status: 'CONFIRMED',
            paymentIntentId: paymentId,
            updatedAt: new Date()
          }
        });
      });
    } catch (dbError: any) {
      // Handle unique constraint violation specifically
      if (dbError.code === 'P2002' && dbError.meta?.target?.includes('razorpayPaymentId')) {
        console.warn('Duplicate razorpayPaymentId constraint violation handled:', paymentId);
        
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
    console.error('Failed to process payment success:', error);
    throw error;
  }
}

async function handlePaymentFailure(paymentEntity: any) {
  try {
    const { id: paymentId, order_id: razorpayOrderId, error_code, error_description } = paymentEntity;

    // Find payment log
    const paymentLog = await prisma.paymentLog.findFirst({
      where: { razorpayOrderId },
      include: { order: true }
    });

    if (!paymentLog) {
      console.error('Payment log not found for Razorpay order:', razorpayOrderId);
      return;
    }

    // Check if this payment failure has already been processed (idempotency check)
    if (paymentLog.razorpayPaymentId === paymentId && paymentLog.status === 'FAILED') {
      console.log('Payment failure already processed:', paymentId);
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
      console.warn('RazorpayPaymentId already exists in another record:', paymentId);
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

    // Update payment log with failure details and clear user's cart
    try {
      await prisma.$transaction(async (tx) => {
        // Update payment log with failure
        await tx.paymentLog.update({
          where: { id: paymentLog.id },
          data: {
            status: 'FAILED',
            razorpayPaymentId: paymentId,
            failureReason: `${error_code}: ${error_description}`,
            gatewayResponse: paymentEntity,
            retryCount: { increment: 1 },
            updatedAt: new Date()
          }
        });

        // Clear user's cart on payment failure for better UX
        await tx.cartItem.deleteMany({
          where: { userId: paymentLog.order.userId }
        });

        // Update order status to failed
        await tx.order.update({
          where: { id: paymentLog.orderId },
          data: {
            status: 'CANCELLED',
            paymentStatus: 'FAILED',
            updatedAt: new Date()
          }
        });
      });
    } catch (dbError: any) {
      // Handle unique constraint violation specifically
      if (dbError.code === 'P2002' && dbError.meta?.target?.includes('razorpayPaymentId')) {
        console.warn('Duplicate razorpayPaymentId constraint violation handled for failure:', paymentId);
        
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
    console.error('Failed to process payment failure:', error);
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
      console.error('Payment log not found for Razorpay order:', razorpayOrderId);
      return;
    }

    // Double-check that the order is fully paid
    if (status === 'paid' && amount_paid >= paymentLog.amount * 100) {
      await prisma.$transaction(async (tx) => {
        await tx.paymentLog.update({
          where: { id: paymentLog.id },
          data: {
            status: 'PAID',
            gatewayResponse: orderEntity,
            updatedAt: new Date()
          }
        });

        await tx.order.update({
          where: { id: paymentLog.orderId },
          data: {
            paymentStatus: 'PAID',
            status: 'CONFIRMED',
            updatedAt: new Date()
          }
        });
      });

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
    console.error('Failed to process order paid:', error);
    throw error;
  }
}

// Only allow POST requests
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
