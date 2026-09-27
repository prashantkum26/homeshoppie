import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../lib/prisma'
import crypto from 'crypto'

// Security configuration
export const SECURITY_CONFIG = {
  rateLimiting: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: {
      default: 100,
      auth: 5, // Login attempts
      api: 200,
      upload: 10
    }
  },
  csrf: {
    tokenExpiry: 24 * 60 * 60 * 1000, // 24 hours
    secret: process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production'
  },
  security: {
    maxFailedLogins: 5,
    lockoutDuration: 30 * 60 * 1000, // 30 minutes
    passwordMinLength: 8
  }
}

// Generate CSRF token
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

// Verify CSRF token
export function verifyCSRFToken(token: string, sessionToken: string): boolean {
  if (!token || !sessionToken) return false
  
  // Create expected token based on session
  const expectedToken = crypto
    .createHmac('sha256', SECURITY_CONFIG.csrf.secret)
    .update(sessionToken)
    .digest('hex')
  
  return crypto.timingSafeEqual(
    Buffer.from(token, 'hex'),
    Buffer.from(expectedToken, 'hex')
  )
}

// Get client IP address
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  return cfConnectingIP || realIP || 'unknown'
}

// Rate limiting implementation
export async function checkRateLimit(
  ipAddress: string,
  endpoint: string,
  userId?: string
): Promise<{
  allowed: boolean
  remaining: number
  resetTime: number
}> {
  const { windowMs, maxRequests } = SECURITY_CONFIG.rateLimiting

  // Determine the rate limit based on endpoint type
  let maxRequestCount = maxRequests.default

  if (endpoint.includes('auth')) {
    maxRequestCount = maxRequests.auth
  } else if (endpoint.includes('upload')) {
    maxRequestCount = maxRequests.upload
  } else if (endpoint.includes('api')) {
    maxRequestCount = maxRequests.api
  }

  const now = new Date()

  // Find existing rate-limit record
  const existingLimit = await prisma.rateLimit.findUnique({
    where: {
      ipAddress_endpoint: {
        ipAddress,
        endpoint
      }
    }
  })

  // No existing record — create a new rate-limit window
  if (!existingLimit) {
    const windowEnd = new Date(now.getTime() + windowMs)

    await prisma.rateLimit.create({
      data: {
        ipAddress,
        endpoint,
        ...(userId !== undefined && { userId }),
        requests: 1,
        windowStart: now,
        windowEnd,
        blocked: false
      }
    })

    return {
      allowed: true,
      remaining: Math.max(0, maxRequestCount - 1),
      resetTime: windowEnd.getTime()
    }
  }

  // Existing rate-limit window has expired
  if (now >= existingLimit.windowEnd) {
    const windowEnd = new Date(now.getTime() + windowMs)

    await prisma.rateLimit.update({
      where: {
        id: existingLimit.id
      },
      data: {
        requests: 1,
        windowStart: now,
        windowEnd,
        blocked: false,
        resetAt: null,
        ...(userId !== undefined && { userId })
      }
    })

    return {
      allowed: true,
      remaining: Math.max(0, maxRequestCount - 1),
      resetTime: windowEnd.getTime()
    }
  }

  // Rate limit exceeded
  if (existingLimit.requests >= maxRequestCount) {
    await prisma.rateLimit.update({
      where: {
        id: existingLimit.id
      },
      data: {
        blocked: true,
        resetAt: existingLimit.windowEnd
      }
    })

    return {
      allowed: false,
      remaining: 0,
      resetTime: existingLimit.windowEnd.getTime()
    }
  }

  // Increment request count
  const updatedLimit = await prisma.rateLimit.update({
    where: {
      id: existingLimit.id
    },
    data: {
      requests: {
        increment: 1
      },
      blocked: false,
      ...(userId !== undefined && { userId })
    }
  })

  return {
    allowed: true,
    remaining: Math.max(
      0,
      maxRequestCount - updatedLimit.requests
    ),
    resetTime: updatedLimit.windowEnd.getTime()
  }
}


// Security logging

export async function logSecurityEvent({
  userId,
  action,
  ipAddress,
  userAgent,
  severity = 'LOW',
  details,
  blocked = false
}: {
  userId?: string
  action: string
  ipAddress: string
  userAgent?: string
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  details?: unknown
  blocked?: boolean
}) {
  try {
    await prisma.securityLog.create({
      data: {
        ...(userId !== undefined && { userId }),
        action: action as any,
        ipAddress,
        ...(userAgent !== undefined && { userAgent }),
        severity,
        details: details !== undefined
          ? JSON.parse(JSON.stringify(details))
          : null,
        blocked
      }
    })
  } catch (error) {
    console.error('Failed to log security event:', error)
  }
}

// Security headers
export function addSecurityHeaders(response: NextResponse): NextResponse {
  // Prevent XSS attacks
  response.headers.set('X-XSS-Protection', '1; mode=block')
  
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY')
  
  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')
  
  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: blob: https:; " +
    "connect-src 'self' https://api.razorpay.com; " +
    "frame-src https://api.razorpay.com;"
  )
  
  // Strict Transport Security (HTTPS only)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }
  
  // Permissions Policy
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(self)'
  )
  
  return response
}

// Input sanitization
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return ''
  
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
}

// Password validation
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (password.length < SECURITY_CONFIG.security.passwordMinLength) {
    errors.push(`Password must be at least ${SECURITY_CONFIG.security.passwordMinLength} characters`)
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number')
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

// Check if user account is locked
export async function checkAccountLock(
  email: string
): Promise<{ locked: boolean; lockUntil?: Date }> {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        isLocked: true,
        lockUntil: true
      }
    })

    if (!user) {
      return { locked: false }
    }

    // Lock expired
    if (
      user.isLocked &&
      user.lockUntil !== null &&
      user.lockUntil < new Date()
    ) {
      await prisma.user.update({
        where: { email },
        data: {
          isLocked: false,
          lockUntil: null,
          failedLoginCount: 0
        }
      })

      return { locked: false }
    }

    return {
      locked: user.isLocked,
      ...(user.lockUntil !== null && {
        lockUntil: user.lockUntil
      })
    }
  } catch (error) {
    console.error('Error checking account lock:', error)

    // Consider failing closed for security-sensitive authentication flows.
    return { locked: false }
  }
}

// Handle failed login attempt
export async function handleFailedLogin(email: string, ipAddress: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, failedLoginCount: true }
    })
    
    if (!user) return
    
    const newFailedCount = user.failedLoginCount + 1
    const shouldLock = newFailedCount >= SECURITY_CONFIG.security.maxFailedLogins
    
    await prisma.user.update({
      where: { email },
      data: {
        failedLoginCount: newFailedCount,
        ...(shouldLock && {
          isLocked: true,
          lockUntil: new Date(Date.now() + SECURITY_CONFIG.security.lockoutDuration)
        })
      }
    })
    
    // Log security event
    await logSecurityEvent({
      userId: user.id,
      action: shouldLock ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED',
      ipAddress,
      severity: shouldLock ? 'HIGH' : 'MEDIUM',
      details: { failedCount: newFailedCount, locked: shouldLock }
    })
    
  } catch (error) {
    console.error('Error handling failed login:', error)
  }
}

// Reset failed login count on successful login
export async function resetFailedLoginCount(email: string, ipAddress: string): Promise<void> {
  try {
    const user = await prisma.user.update({
      where: { email },
      data: {
        failedLoginCount: 0,
        isLocked: false,
        lockUntil: null,
        lastLoginAt: new Date()
      },
      select: { id: true }
    })
    
    // Log successful login
    await logSecurityEvent({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      ipAddress,
      severity: 'LOW'
    })
    
  } catch (error) {
    console.error('Error resetting failed login count:', error)
  }
}
