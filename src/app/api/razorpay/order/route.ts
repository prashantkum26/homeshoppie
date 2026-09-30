import { createSecureOrder, validatePaymentAmount, retryOperation } from "@/lib/razorpay";
import { NextRequest, NextResponse } from "next/server";
import { auth, hasVerifiedContact } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  logSecurityEvent,
  checkEnhancedRateLimit,
  getClientIP,
  toCurrencyUnit
} from "@/lib/auditTrail";
import { isSameOriginRequest } from "@/lib/security";
import {
  getPaymentMethodAvailability,
  getGatewayMethodRestriction,
  describePaymentMethodUnavailability
} from "@/lib/payment-methods";

function getOrderGatewaySnapshot(order: Record<string, unknown>) {
  return {
    id: typeof order.id === 'string' ? order.id : undefined,
    amount: typeof order.amount === 'number' ? order.amount : undefined,
    currency: typeof order.currency === 'string' ? order.currency : undefined,
    status: typeof order.status === 'string' ? order.status : undefined,
    receipt: typeof order.receipt === 'string' ? order.receipt : undefined,
  };
}

export async function POST(req: NextRequest) {
  const ipAddress = getClientIP(req);

  try {
    if (!isSameOriginRequest(req)) {
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
    }

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

    if (!(await hasVerifiedContact(session.user.id))) {
      return NextResponse.json(
        { error: "Email and required contact verification must be completed before payment." },
        { status: 403 }
      );
    }

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
    const { orderId } = body;

    // Validate required fields
    if (!orderId) {
      return NextResponse.json(
        { error: 'OrderId is required.' },
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

    if (internalOrder.paymentStatus === "PAID") {
        await logSecurityEvent({
          userId: session.user.id,
          action: "SUSPICIOUS_ACTIVITY",
          ipAddress,
          severity: "HIGH",
          details: {
            endpoint: "/api/razorpay/order",
            reason:
              "Attempted payment creation for already-paid order",
            orderId: internalOrder.id,
            orderStatus:
              internalOrder.paymentStatus,
          },
          blocked: true,
        });

        return NextResponse.json(
          {
            error:
              "Order has already been paid.",
            code: "ORDER_ALREADY_PAID",
          },
          { status: 400 }
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

    const amount = internalOrder.totalAmount;
    const amountValidation = validatePaymentAmount(amount);
    if (!amountValidation.valid) {
      return NextResponse.json(
        { error: "Invalid order amount" },
        { status: 400 }
      );
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

    // Create secure Razorpay order with retry mechanism.
    // Availability is re-asserted here because the order row may be minutes
    // old and the method could have been disabled in the meantime.
    const methodAvailability = getPaymentMethodAvailability(
      internalOrder.paymentMethod,
      internalOrder.totalAmount
    );

    if (!methodAvailability.available) {
      return NextResponse.json(
        {
          error: describePaymentMethodUnavailability(methodAvailability.reason),
          code: 'PAYMENT_METHOD_UNAVAILABLE',
          reason: methodAvailability.reason
        },
        { status: 409 }
      );
    }

    // Razorpay rejects some methods as an order-level restriction; the
    // catalogue decides whether a restriction can be sent at all.
    const orderMethodRestriction = getGatewayMethodRestriction(internalOrder.paymentMethod);

    const razorpayOrder = await retryOperation(async () => {
      return await createSecureOrder({
        amount,
        orderId: internalOrder.id,
        userId: session.user.id,
        receipt: `receipt_${internalOrder.orderNumber}`,
        notes: {
          order_number: internalOrder.orderNumber
        },
        paymentMethod: orderMethodRestriction
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
        // Update existing log with new attempt
        await prisma.paymentLog.update({
          where: { id: existingLog.id },
          data: {
            status: 'PENDING',
            retryCount: { increment: 1 },
            gatewayResponse: getOrderGatewaySnapshot(razorpayOrder),
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
            gatewayResponse: getOrderGatewaySnapshot(razorpayOrder)
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
          } else {
            console.error('Razorpay payment log constraint violation without an existing record');
            throw dbError;
          }
        } else if (target?.includes('razorpayPaymentId')) {
          console.error('Razorpay payment ID constraint violation during order creation');
          throw dbError;
        } else {
          console.error('Unknown Razorpay payment log constraint violation');
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
