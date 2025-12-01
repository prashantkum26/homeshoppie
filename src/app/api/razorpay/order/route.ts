import { createSecureOrder, validatePaymentAmount, retryOperation } from "@/lib/razorpay";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logSecurityEvent, checkRateLimit, getClientIP } from "@/lib/security";

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
    const rateLimit = await checkRateLimit(req, '/api/razorpay/order', session.user.id);
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

    // Check if payment order already exists for this order
    const existingPaymentLog = await prisma.paymentLog.findFirst({
      where: {
        orderId: internalOrder.id,
        status: { not: 'FAILED' }
      }
    });

    if (existingPaymentLog?.razorpayOrderId) {
      // Return existing Razorpay order if already created
      return NextResponse.json({
        id: existingPaymentLog.razorpayOrderId,
        amount: existingPaymentLog.amount * 100,
        currency: existingPaymentLog.currency,
        status: 'created',
        existing: true
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

    // Log the payment order creation in our database
    await prisma.paymentLog.create({
      data: {
        orderId: internalOrder.id,
        razorpayOrderId: razorpayOrder.id,
        amount: amount,
        currency: 'INR',
        status: 'PENDING',
        gateway: 'razorpay',
        gatewayResponse: JSON.parse(JSON.stringify(razorpayOrder))
      }
    });

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
