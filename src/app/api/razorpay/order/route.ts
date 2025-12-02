import { createSecureOrder, validatePaymentAmount, retryOperation } from "@/lib/razorpay";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { 
  logSecurityEvent, 
  checkEnhancedRateLimit, 
  getClientIP,
  toCurrencyUnit,
  fromCurrencyUnit,
  logPaymentOperation 
} from "@/lib/auditTrail";

export async function POST(req: NextRequest) {
  const ipAddress = getClientIP(req);

  try {
    // Authentication check
    const session = await auth();
    if (!session?.user?.id) {
      await logSecurityEvent({
        action: 'UNAUTHORIZED_ACCESS',
        ipAddress,
        severity: 'HIGH',
        details: { endpoint: '/api/razorpay/order', reason: 'No authentication' },
        blocked: true
      });

      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      );
    }

    // Rate limiting check
    const rateLimit = await checkEnhancedRateLimit(ipAddress, '/api/razorpay/order', session.user.id, 5, 1);
    if (!rateLimit.allowed) {
      await logSecurityEvent({
        userId: session.user.id,
        action: 'SUSPICIOUS_ACTIVITY',
        ipAddress,
        severity: 'MEDIUM',
        details: {
          endpoint: '/api/razorpay/order',
          reason: 'Rate limit exceeded',
          requests: rateLimit.remaining
        },
        blocked: true
      });

      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString()
          }
        }
      );
    }

    const body = await req.json();
    const { amount, orderId, receipt, notes } = body;

    // Validate required fields
    if (!amount || !orderId) {
      return NextResponse.json(
        { error: 'Amount and orderId are required' },
        { status: 400 }
      );
    }

    // Validate amount
    const amountValidation = validatePaymentAmount(amount);
    if (!amountValidation.valid) {
      await logSecurityEvent({
        userId: session.user.id,
        action: 'SUSPICIOUS_ACTIVITY',
        ipAddress,
        severity: 'MEDIUM',
        details: {
          endpoint: '/api/razorpay/order',
          reason: 'Invalid payment amount',
          amount,
          error: amountValidation.error
        }
      });

      return NextResponse.json(
        { error: amountValidation.error },
        { status: 400 }
      );
    }

    // Verify the order exists and belongs to the user
    const internalOrder = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: session.user.id
      }
    });

    if (!internalOrder) {
      await logSecurityEvent({
        userId: session.user.id,
        action: 'UNAUTHORIZED_ACCESS',
        ipAddress,
        severity: 'HIGH',
        details: {
          endpoint: '/api/razorpay/order',
          reason: 'Order not found or unauthorized access',
          orderId
        },
        blocked: true
      });

      return NextResponse.json(
        { error: 'Order not found or unauthorized' },
        { status: 404 }
      );
    }

    // SECURITY CHECK: Verify order payment status and attempt limits
    const existingPaymentLog = await prisma.paymentLog.findFirst({
      where: {
        orderId: internalOrder.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // SECURITY: Block attempts on already paid orders
    if (existingPaymentLog?.status === 'PAID') {
      await logSecurityEvent({
        userId: session.user.id,
        action: 'SUSPICIOUS_ACTIVITY',
        ipAddress,
        severity: 'HIGH',
        details: {
          endpoint: '/api/razorpay/order',
          reason: 'Attempted payment creation on already paid order',
          orderId: internalOrder.id,
          orderStatus: internalOrder.paymentStatus,
          action_taken: 'Payment creation blocked'
        },
        blocked: true
      });

      return NextResponse.json({
        error: 'Order has already been paid. Cannot create new payment.',
        code: 'ORDER_ALREADY_PAID'
      }, { status: 400 });
    }

    // SECURITY: Limit retry attempts (max 5 attempts per order)
    const attemptCount = await prisma.paymentLog.count({
      where: {
        orderId: internalOrder.id
      }
    });

    if (attemptCount >= 5) {
      await logSecurityEvent({
        userId: session.user.id,
        action: 'SUSPICIOUS_ACTIVITY',
        ipAddress,
        severity: 'HIGH',
        details: {
          endpoint: '/api/razorpay/order',
          reason: 'Exceeded maximum payment attempts',
          orderId: internalOrder.id,
          attemptCount,
          action_taken: 'Payment creation blocked'
        },
        blocked: true
      });

      return NextResponse.json({
        error: 'Maximum payment attempts exceeded. Please contact support.',
        code: 'MAX_ATTEMPTS_EXCEEDED'
      }, { status: 429 });
    }

    // Return existing pending payment if available (within last 30 minutes)
    const recentPendingPayment = await prisma.paymentLog.findFirst({
      where: {
        orderId: internalOrder.id,
        status: 'PENDING',
        createdAt: {
          gte: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (recentPendingPayment?.razorpayOrderId) {
      // Return existing recent pending payment
      return NextResponse.json({
        id: recentPendingPayment.razorpayOrderId,
        amount: recentPendingPayment.amount * 100,
        currency: recentPendingPayment.currency,
        status: 'created',
        existing: true,
        attempt_number: 1 // Default attempt number for existing payments
      });
    }

    // Create secure Razorpay order with retry mechanism
    const razorpayOrder = await retryOperation(async () => {
      return await createSecureOrder({
        amount,
        orderId: internalOrder.id,
        userId: session.user.id,
        receipt: receipt || `receipt_${internalOrder.orderNumber}`,
        notes: {
          ...notes,
          order_number: internalOrder.orderNumber,
          customer_email: session.user.email || '',
          customer_name: session.user.name || '',
        }
      });
    });

    // Log the payment order creation in our database with duplicate handling
    try {
      // Check if payment log already exists for this order
      const existingLog = await prisma.paymentLog.findFirst({
        where: {
          orderId: internalOrder.id,
          razorpayOrderId: razorpayOrder.id
        }
      });

      if (existingLog) {
        console.log('Using existing payment log for order:', razorpayOrder.id);
        // Update existing log with new attempt
        await prisma.paymentLog.update({
          where: { id: existingLog.id },
          data: {
            status: 'PENDING',
            retryCount: { increment: 1 },
            gatewayResponse: JSON.parse(JSON.stringify(razorpayOrder)),
            updatedAt: new Date()
          }
        });
      } else {
        // Create new payment log
        await prisma.paymentLog.create({
          data: {
            orderId: internalOrder.id,
            razorpayOrderId: razorpayOrder.id,
            amount: toCurrencyUnit(amount),
            currency: 'INR',
            status: 'PENDING',
            gateway: 'razorpay',
            gatewayResponse: JSON.parse(JSON.stringify(razorpayOrder))
          }
        });
      }
    } catch (dbError: any) {
      // Handle unique constraint violations gracefully
      if (dbError.code === 'P2002') {
        const target = dbError.meta?.target;
        
        if (target?.includes('order_razorpay_attempt')) {
          console.warn('Duplicate order+razorpay combination handled:', {
            orderId: internalOrder.id,
            razorpayOrderId: razorpayOrder.id
          });
          
          // Find and use existing payment log
          const existingLog = await prisma.paymentLog.findFirst({
            where: {
              orderId: internalOrder.id,
              razorpayOrderId: razorpayOrder.id
            }
          });
          
          if (existingLog) {
            console.log('Using existing payment log after constraint violation');
          } else {
            console.error('Constraint violation but no existing record found');
            throw dbError;
          }
        } else if (target?.includes('razorpayPaymentId')) {
          console.error('RazorpayPaymentId constraint violation during order creation - this should not happen');
          throw dbError;
        } else {
          console.error('Unknown constraint violation:', target);
          throw dbError;
        }
      } else {
        throw dbError; // Re-throw other database errors
      }
    }

    // Log successful order creation
    await logSecurityEvent({
      userId: session.user.id,
      action: 'API_ACCESS',
      ipAddress,
      severity: 'LOW',
      details: {
        endpoint: '/api/razorpay/order',
        action: 'order_created',
        razorpay_order_id: razorpayOrder.id,
        amount,
        order_id: orderId
      }
    });

    return NextResponse.json({
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      status: razorpayOrder.status,
      idempotency_key: razorpayOrder.idempotency_key
    });

  } catch (error: any) {
    console.error('Razorpay order creation failed:', error);

    // Log the error for security monitoring
    const session = await auth();
    const logData: any = {
      action: 'API_ACCESS',
      ipAddress,
      severity: 'HIGH',
      details: {
        endpoint: '/api/razorpay/order',
        error: error.message,
        action: 'order_creation_failed'
      }
    };

    if (session?.user?.id) {
      logData.userId = session.user.id;
    }

    await logSecurityEvent(logData);

    return NextResponse.json(
      {
        error: 'Failed to create payment order. Please try again.',
        code: 'ORDER_CREATION_FAILED'
      },
      { status: 500 }
    );
  }
}
