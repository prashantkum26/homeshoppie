import Razorpay from "razorpay";
import crypto from "crypto";

/**
 * Get Razorpay client lazily.
 *
 * IMPORTANT:
 * Do not create the Razorpay client at module-load time.
 * Next.js evaluates imported modules during `next build`,
 * so runtime environment validation here can break the build.
 */
export const getRazorpay = (): Razorpay => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId) {
    throw new Error("Missing RAZORPAY_KEY_ID");
  }

  if (!keySecret) {
    throw new Error("Missing RAZORPAY_KEY_SECRET");
  }

  if (!keyId.startsWith("rzp_")) {
    throw new Error("Invalid Razorpay Key ID format");
  }

  /*
   * RAZORPAY_MODE is separate from NODE_ENV.
   *
   * NODE_ENV=production:
   *   Next.js production build/runtime.
   *
   * RAZORPAY_MODE=live:
   *   Razorpay Live credentials are expected.
   */
  if (
    process.env.RAZORPAY_MODE === "live" &&
    keyId.startsWith("rzp_test_")
  ) {
    throw new Error(
      "Test Razorpay credentials cannot be used in live mode"
    );
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

/**
 * Razorpay configuration constants.
 *
 * Amounts are represented in RUPEES by this application.
 * Razorpay receives amounts in PAISE.
 */
export const RAZORPAY_CONFIG = {
  currency: "INR",

  timeout: 30000,

  maxRetryAttempts: 3,

  retryDelayMs: 1000,

  webhook: {
    tolerance: 300,
  },

  limits: {
    minAmount: 1,
    maxAmount: 5000,
    dailyLimit: 10000,
  },

  fraudDetection: {
    maxFailedAttempts: 5,
    suspiciousAmountThreshold: 1000,
    timeWindowMinutes: 60,
  },
};

/**
 * Safely compare two hexadecimal signatures.
 *
 * timingSafeEqual throws when the buffers have
 * different lengths, so check the length first.
 */
const safeCompareHex = (
  providedSignature: string,
  expectedSignature: string
): boolean => {
  try {
    if (!providedSignature || !expectedSignature) {
      return false;
    }

    const provided = Buffer.from(providedSignature, "hex");
    const expected = Buffer.from(expectedSignature, "hex");

    if (provided.length !== expected.length) {
      return false;
    }

    return crypto.timingSafeEqual(provided, expected);
  } catch {
    return false;
  }
};

/**
 * Get the webhook secret at runtime.
 *
 * Reading it here instead of storing it in a module-level
 * constant makes environment handling safer.
 */
const getWebhookSecret = (): string => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error("Missing RAZORPAY_WEBHOOK_SECRET");
  }

  return secret;
};

/**
 * Verify Razorpay webhook signature.
 */
export const verifyWebhookSignature = (
  body: string,
  signature: string,
  secret?: string
): boolean => {
  try {
    if (!body || !signature) {
      return false;
    }

    const webhookSecret = secret || getWebhookSecret();

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(body)
      .digest("hex");

    return safeCompareHex(
      signature,
      expectedSignature
    );
  } catch (error) {
    console.error(
      "Webhook signature verification failed:",
      error
    );

    return false;
  }
};

/**
 * Verify Razorpay payment signature.
 *
 * This does NOT create a Razorpay client.
 * It only uses HMAC-SHA256 and the Razorpay secret.
 */
export const verifyPaymentSignature = (
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
  secret?: string
): boolean => {
  try {
    if (
      !razorpayOrderId ||
      !razorpayPaymentId ||
      !razorpaySignature
    ) {
      return false;
    }

    const keySecret =
      secret || process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      return false;
    }

    const body =
      `${razorpayOrderId}|${razorpayPaymentId}`;

    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(body)
      .digest("hex");

    return safeCompareHex(
      razorpaySignature,
      expectedSignature
    );
  } catch (error) {
    console.error(
      "Payment signature verification failed:",
      error
    );

    return false;
  }
};

/**
 * Generate a deterministic idempotency key.
 *
 * The same user + order + amount produces the same key.
 */
export const generateIdempotencyKey = (
  userId: string,
  orderId: string,
  amount: number
): string => {
  const data =
    `${userId}-${orderId}-${amount}`;

  return crypto
    .createHash("sha256")
    .update(data)
    .digest("hex");
};

/**
 * Validate payment amount.
 *
 * Input amount is in RUPEES.
 */
/**
 * Validate payment amount.
 *
 * Input amount is in RUPEES.
 * Uses string normalization to prevent JS floating-point precision errors.
 */
export const validatePaymentAmount = (
  amount: number
): { valid: boolean; error?: string } => {
  if (!Number.isFinite(amount)) {
    return {
      valid: false,
      error: "Invalid payment amount",
    };
  }

  if (amount <= 0) {
    return {
      valid: false,
      error: "Payment amount must be greater than zero",
    };
  }

  /*
   * Bulletproof decimal place check:
   * Normalizes the number to 2 decimal places and verifies 
   * it matches the original value, preventing floating-point drift.
   */
  const normalized = Number(amount.toFixed(2));
  if (normalized !== amount) {
    return {
      valid: false,
      error: "Payment amount cannot have more than two decimal places",
    };
  }

  if (amount < RAZORPAY_CONFIG.limits.minAmount) {
    return {
      valid: false,
      error: `Minimum payment amount is ₹${RAZORPAY_CONFIG.limits.minAmount}`,
    };
  }

  if (amount > RAZORPAY_CONFIG.limits.maxAmount) {
    return {
      valid: false,
      error: `Maximum payment amount is ₹${RAZORPAY_CONFIG.limits.maxAmount}`,
    };
  }

  return {
    valid: true,
  };
};

/**
 * Create a Razorpay order.
 *
 * `amount` is supplied in RUPEES.
 * Razorpay receives the amount in PAISE.
 */
export const createSecureOrder = async (params: {
  amount: number;
  orderId: string;
  userId: string;
  receipt?: string;
  notes?: Record<string, string>;
  paymentMethod: "netbanking" | "upi" | "card" | "emandate" | "nach";
}) => {
  const {
    amount,
    orderId,
    userId,
    receipt,
    notes = {},
    paymentMethod
  } = params;

  if (!orderId) {
    throw new Error("Order ID is required");
  }

  if (!userId) {
    throw new Error("User ID is required");
  }

  const amountValidation =
    validatePaymentAmount(amount);

  if (!amountValidation.valid) {
    throw new Error(
      amountValidation.error ||
        "Invalid payment amount"
    );
  }

  /*
   * Convert RUPEES to PAISE.
   *
   * Example:
   * ₹500 -> 50000 paise
   */
  const amountInPaise = Math.round(amount * 100);

  const idempotencyKey =
    generateIdempotencyKey(
      userId,
      orderId,
      amount
    );

  const orderOptions = {
    amount: amountInPaise,
    currency: RAZORPAY_CONFIG.currency,
    receipt: receipt || `receipt_${orderId}`,
    payment_capture: true,
    notes: {
      ...notes,
      order_id: orderId,
      user_id: userId,
      created_at: new Date().toISOString(),
    }
  };

  try {
    /*
     * IMPORTANT:
     * Razorpay is instantiated only when an
     * actual order-creation request occurs.
     */
    const razorpay = getRazorpay();

    const order = await razorpay.orders.create({ ...orderOptions, method: paymentMethod });

    console.log("Secure Razorpay order created:",
      {
        razorpay_order_id: order.id,
        internal_order_id: orderId,
        amount,
        amount_in_paise: amountInPaise,
        user_id: userId,
        idempotency_key: idempotencyKey,
        timestamp: new Date().toISOString()
      }
    );

    return { ...order, idempotency_key: idempotencyKey };
  } catch (error: unknown) {
    console.error("Failed to create Razorpay order:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown Razorpay error";

    throw new Error(
      `Payment order creation failed: ${message}`
    );
  }
};

/**
 * Retry mechanism for failed operations.
 */
export const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number =
    RAZORPAY_CONFIG.maxRetryAttempts,
  delayMs: number =
    RAZORPAY_CONFIG.retryDelayMs
): Promise<T> => {
  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <= maxRetries;
    attempt++
  ) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        break;
      }

      const delay =
        delayMs *
        Math.pow(2, attempt - 1);

      await new Promise((resolve) =>
        setTimeout(resolve, delay)
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(
        "Operation failed after retries"
      );
};
