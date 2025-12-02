import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyPaymentSignature, retryOperation } from "@/lib/razorpay";
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
        details: { endpoint: '/api/razorpay/verify', reason: 'No authentication' },
        blocked: true
      });
      
      return NextResponse.json(
        { success: false, error: 'Unauthorized access' },
        { status: 401 }
      );
    }

    // Rate limiting check
    const rateLimit = await checkRateLimit(req, '/api/razorpay/verify', session.user.id);
    if (!rateLimit.allowed) {
      await logSecurityEvent({
        userId: session.user.id,
        action: 'SUSPICIOUS_ACTIVITY',
        ipAddress,
        severity: 'MEDIUM',
        details: { 
          endpoint: '/api/razorpay/verify', 
          reason: 'Rate limit exceeded',
          requests: rateLimit.remaining 
        },
        blocked: true
      });
      
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      await logSecurityEvent({
        userId: session.user.id,
        action: 'SUSPICIOUS_ACTIVITY',
        ipAddress,
        severity: 'MEDIUM',
        details: { 
          endpoint: '/api/razorpay/verify', 
          reason: 'Missing required payment verification fields',
          provided_fields: {
            order_id: !!razorpay_order_id,
            payment_id: !!razorpay_payment_id,
            signature: !!razorpay_signature
          }
        }
      });
      
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Find payment log entry - get the latest attempt for this order
    const paymentLog = await prisma.paymentLog.findFirst({
      where: {
        razorpayOrderId: razorpay_order_id
      },
      include: {
        order: {
          select: {
            userId: true,
            id: true,
            orderNumber: true,
            totalAmount: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc' // Get the latest attempt by creation time
      }
    });

    if (!paymentLog) {
      await logSecurityEvent({
        userId: session.user.id,
        action: 'SUSPICIOUS_ACTIVITY',
        ipAddress,
        severity: 'HIGH',
        details: { 
          endpoint: '/api/razorpay/verify', 
          reason: 'Payment order not found',
          razorpay_order_id
        },
        blocked: true
      });
      
      return NextResponse.json(
        { success: false, error: 'Payment order not found' },
        { status: 404 }
      );
    }

    // Check if this payment has already been verified (idempotency check)
    if (paymentLog.razorpayPaymentId === razorpay_payment_id && paymentLog.status === 'PAID') {
      console.log('Payment already verified:', razorpay_payment_id);
      return NextResponse.json({ 
        success: true,
        order_id: paymentLog.order.id,
        order_number: paymentLog.order.orderNumber,
        already_processed: true
      });
    }

    // Enhanced programmatic duplicate checking for razorpayPaymentId
    if (razorpay_payment_id) {
      const existingPaymentWithId = await prisma.paymentLog.findFirst({
        where: {
          razorpayPaymentId: razorpay_payment_id,
          id: { not: paymentLog.id }
        }
      });

      if (existingPaymentWithId) {
        console.warn('RazorpayPaymentId already processed - blocking duplicate:', razorpay_payment_id);
        await logSecurityEvent({
          userId: session.user.id,
          action: 'SUSPICIOUS_ACTIVITY',
          ipAddress,
          severity: 'CRITICAL',
          details: { 
            endpoint: '/api/razorpay/verify', 
            reason: 'Payment ID already processed - duplicate transaction blocked',
            razorpay_payment_id,
            existing_log_id: existingPaymentWithId.id,
            current_log_id: paymentLog.id,
            action_taken: 'Payment verification rejected'
          }
        });
        
        return NextResponse.json(
          { success: false, error: 'Payment already processed - duplicate transaction blocked' },
          { status: 400 }
        );
      }
    }

    // Verify order belongs to authenticated user
    if (paymentLog.order.userId !== session.user.id) {
      await logSecurityEvent({
        userId: session.user.id,
        action: 'UNAUTHORIZED_ACCESS',
        ipAddress,
        severity: 'CRITICAL',
        details: { 
          endpoint: '/api/razorpay/verify', 
          reason: 'Attempting to verify payment for another user\'s order',
          razorpay_order_id,
          order_owner: paymentLog.order.userId
        },
        blocked: true
      });
      
      return NextResponse.json(
        { success: false, error: 'Unauthorized access' },
        { status: 403 }
      );
    }

    // SECURITY: Check if order is already in PAID status (double payment prevention)
    const currentOrderStatus = await prisma.order.findUnique({
      where: { id: paymentLog.order.id },
      select: { paymentStatus: true, status: true }
    });

    if (currentOrderStatus?.paymentStatus === 'PAID') {
      await logSecurityEvent({
        userId: session.user.id,
        action: 'SUSPICIOUS_ACTIVITY',
        ipAddress,
        severity: 'HIGH',
        details: { 
          endpoint: '/api/razorpay/verify', 
          reason: 'Attempted payment verification on already paid order',
          razorpay_order_id,
          razorpay_payment_id,
          order_id: paymentLog.order.id,
          action_taken: 'Payment verification blocked'
        },
        blocked: true
      });
      
      return NextResponse.json(
        { success: false, error: 'Order has already been paid' },
        { status: 400 }
      );
    }

    // Verify payment signature using secure function
    const isValidSignature = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValidSignature) {
      // Log failed verification attempt
      await logSecurityEvent({
        userId: session.user.id,
        action: 'SUSPICIOUS_ACTIVITY',
        ipAddress,
        severity: 'HIGH',
        details: { 
          endpoint: '/api/razorpay/verify', 
          reason: 'Invalid payment signature',
          razorpay_order_id,
          razorpay_payment_id
        },
        blocked: true
      });

      // Update payment log with failure and clear cart
      await prisma.$transaction(async (tx) => {
        await tx.paymentLog.update({
          where: { id: paymentLog.id },
          data: {
            status: 'FAILED',
            failureReason: 'Invalid signature verification',
            razorpayPaymentId: razorpay_payment_id,
            signature: razorpay_signature,
            retryCount: { increment: 1 },
            updatedAt: new Date()
          }
        });

        // Clear user's cart on verification failure
        await tx.cartItem.deleteMany({
          where: { userId: session.user.id }
        });

        // Update order status to cancelled
        await tx.order.update({
          where: { id: paymentLog.order.id },
          data: {
            status: 'CANCELLED',
            paymentStatus: 'FAILED',
            updatedAt: new Date()
          }
        });
      });
      
      return NextResponse.json(
        { success: false, error: 'Payment verification failed' },
        { status: 400 }
      );
    }

    // Payment verified successfully - update records with error handling
    try {
      await retryOperation(async () => {
        await prisma.$transaction(async (tx) => {
          // Use updateMany with where clause to avoid unique constraint issues
          const updateResult = await tx.paymentLog.updateMany({
            where: {
              id: paymentLog.id,
              OR: [
                { razorpayPaymentId: null },
                { razorpayPaymentId: razorpay_payment_id } // Allow updating same payment ID
              ]
            },
            data: {
              status: 'PAID',
              razorpayPaymentId: razorpay_payment_id,
              signature: razorpay_signature,
              updatedAt: new Date()
            }
          });

          // If no rows were updated, payment ID might already be set by another process
          if (updateResult.count === 0) {
            console.warn('Payment log not updated - possibly already processed by another request:', razorpay_payment_id);
            return;
          }

          // Update order status (keep the same payment method as originally selected)
          await tx.order.update({
            where: { id: paymentLog.order.id },
            data: {
              paymentStatus: 'PAID',
              status: 'CONFIRMED',
              paymentIntentId: razorpay_payment_id,
              updatedAt: new Date()
            }
          });

          // Clear user's cart after successful payment
          await tx.cartItem.deleteMany({
            where: { userId: session.user.id }
          });
        });
      });
    } catch (dbError: any) {
      // Handle unique constraint violation specifically
      if (dbError.code === 'P2002' && dbError.meta?.target?.includes('razorpayPaymentId')) {
        console.warn('Duplicate razorpayPaymentId constraint violation handled in verify:', razorpay_payment_id);
        
        await logSecurityEvent({
          userId: session.user.id,
          action: 'API_ACCESS',
          ipAddress,
          severity: 'MEDIUM',
          details: {
            endpoint: '/api/razorpay/verify',
            action: 'duplicate_constraint_handled',
            razorpay_payment_id,
            order_id: paymentLog.order.id
          }
        });
        
        // Check if the payment was actually processed by another request
        const updatedPaymentLog = await prisma.paymentLog.findUnique({
          where: { id: paymentLog.id },
          include: { order: true }
        });
        
        if (updatedPaymentLog?.status === 'PAID') {
          return NextResponse.json({ 
            success: true,
            order_id: updatedPaymentLog.order.id,
            order_number: updatedPaymentLog.order.orderNumber,
            concurrent_processing: true
          });
        } else {
          return NextResponse.json(
            { success: false, error: 'Payment processing conflict. Please try again.' },
            { status: 409 }
          );
        }
      }
      throw dbError; // Re-throw other database errors
    }

    // Log successful payment verification
    await logSecurityEvent({
      userId: session.user.id,
      action: 'API_ACCESS',
      ipAddress,
      severity: 'LOW',
      details: {
        endpoint: '/api/razorpay/verify',
        action: 'payment_verified',
        razorpay_order_id,
        razorpay_payment_id,
        order_number: paymentLog.order.orderNumber,
        amount: paymentLog.order.totalAmount
      }
    });

    return NextResponse.json({ 
      success: true,
      order_id: paymentLog.order.id,
      order_number: paymentLog.order.orderNumber
    });

  } catch (error: any) {
    console.error('Razorpay payment verification failed:', error);
    
    // Log the error for security monitoring
    const session = await auth();
    const logData: any = {
      action: 'API_ACCESS',
      ipAddress,
      severity: 'CRITICAL',
      details: {
        endpoint: '/api/razorpay/verify',
        error: error.message,
        action: 'payment_verification_failed'
      }
    };
    
    if (session?.user?.id) {
      logData.userId = session.user.id;
    }
    
    await logSecurityEvent(logData);

    return NextResponse.json(
      { 
        success: false,
        error: 'Payment verification failed. Please contact support.',
        code: 'VERIFICATION_ERROR'
      },
      { status: 500 }
    );
  }
}
