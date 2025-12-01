import Razorpay from "razorpay";
import crypto from "crypto";

// Environment validation
const validateEnvironmentVariables = () => {
  const requiredVars = {
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
  };

  const missing = Object.entries(requiredVars)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate key format (Razorpay keys start with rzp_)
  if (!requiredVars.RAZORPAY_KEY_ID?.startsWith('rzp_')) {
    throw new Error('Invalid Razorpay Key ID format');
  }

  // In production, ensure we're not using test credentials
  if (process.env.NODE_ENV === 'production' && requiredVars.RAZORPAY_KEY_ID?.includes('test')) {
    throw new Error('Test Razorpay credentials cannot be used in production');
  }
};

// Validate environment variables on module load
validateEnvironmentVariables();

// Secure Razorpay configuration
export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// Razorpay configuration constants
export const RAZORPAY_CONFIG = {
  currency: 'INR',
  timeout: 30000, // 30 seconds timeout
  maxRetryAttempts: 3,
  retryDelayMs: 1000,
  webhook: {
    secret: process.env.RAZORPAY_WEBHOOK_SECRET!,
    tolerance: 300, // 5 minutes tolerance for webhook timestamp
  },
  limits: {
    minAmount: 100, // ₹1.00 minimum
    maxAmount: 500000, // ₹5,000 maximum for security
    dailyLimit: 1000000, // ₹10,000 daily limit per user
  },
  fraudDetection: {
    maxFailedAttempts: 5,
    suspiciousAmountThreshold: 100000, // ₹1,000
    timeWindowMinutes: 60,
  }
};

// Webhook signature verification
export const verifyWebhookSignature = (
  body: string,
  signature: string,
  secret: string = RAZORPAY_CONFIG.webhook.secret
): boolean => {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return false;
  }
};

// Payment signature verification (for frontend callback)
export const verifyPaymentSignature = (
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
  secret: string = process.env.RAZORPAY_KEY_SECRET!
): boolean => {
  try {
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(razorpaySignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('Payment signature verification failed:', error);
    return false;
  }
};

// Generate idempotency key for payments
export const generateIdempotencyKey = (
  userId: string,
  orderId: string,
  amount: number
): string => {
  const data = `${userId}-${orderId}-${amount}-${Date.now()}`;
  return crypto.createHash('sha256').update(data).digest('hex');
};

// Validate payment amount
export const validatePaymentAmount = (amount: number): { valid: boolean; error?: string } => {
  if (amount < RAZORPAY_CONFIG.limits.minAmount) {
    return {
      valid: false,
      error: `Minimum payment amount is ₹${RAZORPAY_CONFIG.limits.minAmount / 100}`
    };
  }

  if (amount > RAZORPAY_CONFIG.limits.maxAmount) {
    return {
      valid: false,
      error: `Maximum payment amount is ₹${RAZORPAY_CONFIG.limits.maxAmount / 100}`
    };
  }

  return { valid: true };
};

// Create order with enhanced security
export const createSecureOrder = async (params: {
  amount: number;
  orderId: string;
  userId: string;
  receipt?: string;
  notes?: Record<string, string>;
}) => {
  const { amount, orderId, userId, receipt, notes = {} } = params;

  // Validate amount
  const amountValidation = validatePaymentAmount(amount);
  if (!amountValidation.valid) {
    throw new Error(amountValidation.error);
  }

  // Generate idempotency key
  const idempotencyKey = generateIdempotencyKey(userId, orderId, amount);

  // Enhanced order options
  const orderOptions: any = {
    amount: amount * 100, // Convert to paise
    currency: RAZORPAY_CONFIG.currency,
    receipt: receipt || `receipt_${orderId}`,
    payment_capture: true, // Auto-capture payments
    notes: {
      ...notes,
      order_id: orderId,
      user_id: userId,
      created_at: new Date().toISOString(),
    },
  };

  try {
    const order = await razorpay.orders.create(orderOptions);
    
    // Log order creation for audit
    console.log('Secure order created:', {
      razorpay_order_id: order.id,
      internal_order_id: orderId,
      amount: amount,
      user_id: userId,
      idempotency_key: idempotencyKey,
      timestamp: new Date().toISOString(),
    });

    return {
      ...order,
      idempotency_key: idempotencyKey,
    };
  } catch (error: any) {
    console.error('Failed to create Razorpay order:', error);
    throw new Error(`Payment order creation failed: ${error.message}`);
  }
};

// Retry mechanism for failed operations
export const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = RAZORPAY_CONFIG.maxRetryAttempts,
  delayMs: number = RAZORPAY_CONFIG.retryDelayMs
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        break;
      }
      
      // Exponential backoff
      const delay = delayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};
