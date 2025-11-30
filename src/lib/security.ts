import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../lib/prisma'
import crypto from 'crypto'
import { headers } from 'next/headers'

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
  request: NextRequest,
  endpoint: string,
  userId?: string
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const ipAddress = getClientIP(request)
  const identifier = userId || ipAddress
  
  // Get rate limit configuration based on endpoint
  let maxRequests = SECURITY_CONFIG.rateLimiting.maxRequests.default
  if (endpoint.includes('/auth/')) {
    maxRequests = SECURITY_CONFIG.rateLimiting.maxRequests.auth
  } else if (endpoint.includes('/api/')) {
    maxRequests = SECURITY_CONFIG.rateLimiting.maxRequests.api
  } else if (endpoint.includes('/upload/')) {
    maxRequests = SECURITY_CONFIG.rateLimiting.maxRequests.upload
  }
  
  const windowStart = new Date(Date.now() - SECURITY_CONFIG.rateLimiting.windowMs)
  
  try {
    // Clean old rate limit records
    await prisma.rateLimit.deleteMany({
      where: {
        windowStart: { lt: windowStart }
      }
    })
    
    // Get or create rate limit record
    const existingLimit = await prisma.rateLimit.findUnique({
      where: { ipAddress_endpoint: { ipAddress, endpoint } }
    })
    
    if (!existingLimit) {
      // Create new rate limit record
      await prisma.rateLimit.create({
        data: {
          ipAddress,
          endpoint,
          userId,
          requests: 1,
          windowStart: new Date()
        }
      })
      
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime: Date.now() + SECURITY_CONFIG.rateLimiting.windowMs
      }
    }
    
    // Check if within rate limit
    if (existingLimit.requests >= maxRequests) {
      // Log security event
      if (userId) {
        await logSecurityEvent({
          userId,
          action: 'API_ACCESS',
          ipAddress,
          severity: 'MEDIUM',
          details: { endpoint, rateLimited: true, requests: existingLimit.requests },
          blocked: true
        })
      } else {
        await logSecurityEvent({
          action: 'API_ACCESS',
          ipAddress,
          severity: 'MEDIUM',
          details: { endpoint, rateLimited: true, requests: existingLimit.requests },
          blocked: true
        })
      }
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: existingLimit.windowStart.getTime() + SECURITY_CONFIG.rateLimiting.windowMs
      }
    }
    
    // Increment request count
    await prisma.rateLimit.update({
      where: { id: existingLimit.id },
      data: { requests: { increment: 1 } }
    })
    
    return {
      allowed: true,
      remaining: maxRequests - existingLimit.requests - 1,
      resetTime: existingLimit.windowStart.getTime() + SECURITY_CONFIG.rateLimiting.windowMs
    }
    
  } catch (error) {
    console.error('Rate limit check failed:', error)
    // Fail open for availability
    return { allowed: true, remaining: maxRequests, resetTime: Date.now() }
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
  details?: any
  blocked?: boolean
}) {
  try {
    await prisma.securityLog.create({
      data: {
        userId,
        action: action as any,
        ipAddress,
        userAgent,
        severity,
        details: details ? JSON.parse(JSON.stringify(details)) : null,
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
export async function checkAccountLock(email: string): Promise<{ locked: boolean; lockUntil?: Date }> {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { isLocked: true, lockUntil: true }
    })
    
    if (!user) return { locked: false }
    
    // Check if lock has expired
    if (user.isLocked && user.lockUntil && user.lockUntil < new Date()) {
      // Unlock the account
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
      lockUntil: user.lockUntil || undefined
    }
  } catch (error) {
    console.error('Error checking account lock:', error)
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
