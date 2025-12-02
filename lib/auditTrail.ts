import { prisma } from './prisma';
import { SecurityAction, SecuritySeverity } from '@prisma/client';

// Simple IP extraction utility
function getClientIP(req: any): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0] : req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
  return ip;
}

// Financial precision utilities for MongoDB Float storage
export const CURRENCY_SCALE = 100; // Store paise/cents

export const toCurrencyUnit = (amount: number): number => {
  return Math.round(amount * CURRENCY_SCALE);
};

export const fromCurrencyUnit = (amount: number): number => {
  return amount / CURRENCY_SCALE;
};

export const formatCurrency = (amount: number, currency = 'INR'): string => {
  const value = fromCurrencyUnit(amount);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency
  }).format(value);
};

// Enhanced security logging (using existing SecurityLog model)
interface SecurityEventData {
  userId?: string | null;
  action: SecurityAction;
  ipAddress: string;
  userAgent?: string | null;
  details?: any;
  severity?: SecuritySeverity;
  blocked?: boolean;
}

export async function logSecurityEvent(data: SecurityEventData) {
  try {
    await prisma.securityLog.create({
      data: {
        userId: data.userId || null,
        action: data.action,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent || null,
        details: data.details ? JSON.parse(JSON.stringify(data.details)) : null,
        severity: data.severity || 'LOW',
        blocked: data.blocked || false
      }
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

// Enhanced rate limiting (using existing RateLimit model)
export async function checkEnhancedRateLimit(
  ipAddress: string, 
  endpoint: string, 
  userId?: string,
  maxRequests: number = 60,
  windowMinutes: number = 1
) {
  const windowStart = new Date(Date.now() - (windowMinutes * 60000));

  const existingLimit = await prisma.rateLimit.findFirst({
    where: {
      ipAddress,
      endpoint,
      windowStart: { gte: windowStart }
    }
  });

  if (existingLimit) {
    if (existingLimit.requests >= maxRequests) {
      // Update to blocked status
      await prisma.rateLimit.update({
        where: { id: existingLimit.id },
        data: { 
          blocked: true
        }
      });

      // Log security event
      await logSecurityEvent({
        userId: userId || null,
        action: 'SUSPICIOUS_ACTIVITY',
        ipAddress,
        severity: 'MEDIUM',
        details: {
          endpoint,
          requests: existingLimit.requests,
          maxRequests,
          action: 'rate_limit_exceeded'
        },
        blocked: true
      });

      return { 
        allowed: false, 
        remaining: 0, 
        resetTime: new Date(Date.now() + (5 * 60000)) // 5 minute cooldown
      };
    }

    // Increment request count
    await prisma.rateLimit.update({
      where: { id: existingLimit.id },
      data: { 
        requests: { increment: 1 }
      }
    });

    return { 
      allowed: true, 
      remaining: maxRequests - existingLimit.requests - 1,
      resetTime: new Date(Date.now() + (windowMinutes * 60000))
    };
  } else {
    // For now, allow all requests to avoid schema conflicts
    // TODO: Fix rate limiting schema in production
    return { 
      allowed: true, 
      remaining: maxRequests - 1,
      resetTime: new Date(Date.now() + (windowMinutes * 60000))
    };
  }
}

// Basic audit logging for important operations
export async function logOperation(
  operation: string,
  resourceType: string,
  resourceId: string,
  userId?: string,
  details?: any,
  req?: any
) {
  const ipAddress = req ? getClientIP(req) : 'system';
  
  await logSecurityEvent({
    userId: userId || null,
    action: 'API_ACCESS',
    ipAddress,
    userAgent: req?.headers['user-agent'] || null,
    details: {
      operation,
      resourceType,
      resourceId,
      ...details
    },
    severity: 'LOW'
  });
}

// Product operations with current schema
export async function updateProductWithLogging(
  productId: string,
  updateData: any,
  userId: string,
  req?: any
) {
  // Get old values for logging
  const oldProduct = await prisma.product.findUnique({
    where: { id: productId }
  });

  if (!oldProduct) {
    throw new Error('Product not found');
  }

  // Convert price to currency units if provided
  if (updateData.price !== undefined) {
    updateData.price = toCurrencyUnit(updateData.price);
  }
  if (updateData.compareAt !== undefined) {
    updateData.compareAt = toCurrencyUnit(updateData.compareAt);
  }

  // Update product
  const updatedProduct = await prisma.product.update({
    where: { id: productId },
    data: updateData
  });

  // Log the operation
  await logOperation(
    'UPDATE',
    'Product',
    productId,
    userId,
    {
      oldValues: {
        price: fromCurrencyUnit(oldProduct.price),
        compareAt: oldProduct.compareAt ? fromCurrencyUnit(oldProduct.compareAt) : null,
        stock: oldProduct.stock,
        isActive: oldProduct.isActive
      },
      newValues: {
        price: fromCurrencyUnit(updatedProduct.price),
        compareAt: updatedProduct.compareAt ? fromCurrencyUnit(updatedProduct.compareAt) : null,
        stock: updatedProduct.stock,
        isActive: updatedProduct.isActive
      }
    },
    req
  );

  return updatedProduct;
}

// Order operations with current schema
export async function updateOrderWithLogging(
  orderId: string,
  updateData: any,
  userId: string,
  req?: any
) {
  // Get old values for logging
  const oldOrder = await prisma.order.findUnique({
    where: { id: orderId }
  });

  if (!oldOrder) {
    throw new Error('Order not found');
  }

  // Convert financial fields to currency units if provided
  if (updateData.totalAmount !== undefined) {
    updateData.totalAmount = toCurrencyUnit(updateData.totalAmount);
  }
  if (updateData.subtotalAmount !== undefined) {
    updateData.subtotalAmount = toCurrencyUnit(updateData.subtotalAmount);
  }
  if (updateData.taxAmount !== undefined) {
    updateData.taxAmount = toCurrencyUnit(updateData.taxAmount);
  }

  // Update order
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: updateData
  });

  // Log the operation
  await logOperation(
    'UPDATE',
    'Order',
    orderId,
    userId,
    {
      oldValues: {
        status: oldOrder.status,
        paymentStatus: oldOrder.paymentStatus,
        totalAmount: fromCurrencyUnit(oldOrder.totalAmount)
      },
      newValues: {
        status: updatedOrder.status,
        paymentStatus: updatedOrder.paymentStatus,
        totalAmount: fromCurrencyUnit(updatedOrder.totalAmount)
      }
    },
    req
  );

  return updatedOrder;
}

// Payment logging with current schema (enhanced PaymentLog)
export async function logPaymentOperation(
  operation: string,
  paymentData: any,
  userId?: string,
  req?: any
) {
  await logSecurityEvent({
    userId: userId || null,
    action: 'API_ACCESS',
    ipAddress: req ? getClientIP(req) : 'system',
    userAgent: req?.headers['user-agent'] || null,
    details: {
      operation,
      paymentGateway: paymentData.gateway || 'razorpay',
      amount: paymentData.amount ? fromCurrencyUnit(paymentData.amount) : null,
      orderId: paymentData.orderId,
      status: paymentData.status,
      razorpayOrderId: paymentData.razorpayOrderId,
      razorpayPaymentId: paymentData.razorpayPaymentId
    },
    severity: operation.includes('FAILURE') ? 'HIGH' : 'LOW'
  });
}

// User activity logging
export async function logUserLogin(
  userId: string,
  success: boolean,
  req: any,
  details?: any
) {
  await logSecurityEvent({
    userId,
    action: success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
    ipAddress: getClientIP(req),
    userAgent: req.headers['user-agent'],
    details: details,
    severity: success ? 'LOW' : 'MEDIUM'
  });
}

// Query helpers for common filtering
export const activeProductsOnly = {
  isActive: true
};

export const paidOrdersOnly = {
  paymentStatus: 'PAID'
};

export { getClientIP };
