import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface RateLimitOptions {
  windowMs: number // Time window in milliseconds
  max: number // Maximum number of requests per window
  message?: string
  standardHeaders?: boolean
  legacyHeaders?: boolean
  keyGenerator?: (request: NextRequest) => string
}

// Get client IP address
export function getClientIP(request: NextRequest): string {
  // Try various headers that might contain the real IP
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  
  if (forwarded) {
    // x-forwarded-for can be a comma-separated list, take the first one
    return forwarded.split(',')[0].trim()
  }
  
  if (realIP) {
    return realIP
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP
  }
  
  // Fallback to a default value if no IP found
  return 'unknown'
}

// Create rate limiter
export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later.',
    keyGenerator = (req) => getClientIP(req)
  } = options

  return async (request: NextRequest): Promise<NextResponse | null> => {
    try {
      const identifier = keyGenerator(request)
      const endpoint = new URL(request.url).pathname
      const now = new Date()
      const windowStart = new Date(now.getTime() - windowMs)

      // Clean up old rate limit records
      await prisma.rateLimit.deleteMany({
        where: {
          windowEnd: {
            lt: windowStart
          }
        }
      })

      // Find existing rate limit record
      let rateLimitRecord = await prisma.rateLimit.findUnique({
        where: {
          ipAddress_endpoint: {
            ipAddress: identifier,
            endpoint: endpoint
          }
        }
      })

      if (!rateLimitRecord) {
        // Create new rate limit record
        await prisma.rateLimit.create({
          data: {
            ipAddress: identifier,
            endpoint: endpoint,
            requests: 1,
            windowStart: now,
            windowEnd: new Date(now.getTime() + windowMs),
            blocked: false
          }
        })
        return null // Allow the request
      }

      // Check if current window has expired
      if (rateLimitRecord.windowEnd < now) {
        // Reset the counter for new window
        await prisma.rateLimit.update({
          where: {
            id: rateLimitRecord.id
          },
          data: {
            requests: 1,
            windowStart: now,
            windowEnd: new Date(now.getTime() + windowMs),
            blocked: false
          }
        })
        return null // Allow the request
      }

      // Check if limit exceeded
      if (rateLimitRecord.requests >= max) {
        // Block the request
        await prisma.rateLimit.update({
          where: {
            id: rateLimitRecord.id
          },
          data: {
            blocked: true,
            resetAt: rateLimitRecord.windowEnd
          }
        })

        return NextResponse.json(
          { 
            success: false, 
            message: message,
            retryAfter: Math.ceil((rateLimitRecord.windowEnd.getTime() - now.getTime()) / 1000)
          },
          { 
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((rateLimitRecord.windowEnd.getTime() - now.getTime()) / 1000)),
              'X-RateLimit-Limit': String(max),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.ceil(rateLimitRecord.windowEnd.getTime() / 1000))
            }
          }
        )
      }

      // Increment request count
      await prisma.rateLimit.update({
        where: {
          id: rateLimitRecord.id
        },
        data: {
          requests: rateLimitRecord.requests + 1
        }
      })

      return null // Allow the request

    } catch (error) {
      console.error('Rate limiting error:', error)
      // In case of error, allow the request to proceed
      return null
    }
  }
}

// Memory-based rate limiter (fallback for when database is not available)
const memoryStore = new Map<string, { count: number; resetTime: number }>()

export function createMemoryRateLimit(options: RateLimitOptions) {
  const { windowMs, max, message = 'Too many requests, please try again later.' } = options

  return async (request: NextRequest): Promise<NextResponse | null> => {
    const ip = getClientIP(request)
    const key = `${ip}:${new URL(request.url).pathname}`
    const now = Date.now()

    // Clean up expired entries
    Array.from(memoryStore.entries()).forEach(([k, v]) => {
      if (v.resetTime < now) {
        memoryStore.delete(k)
      }
    })

    const record = memoryStore.get(key)
    
    if (!record) {
      memoryStore.set(key, { count: 1, resetTime: now + windowMs })
      return null
    }

    if (record.resetTime < now) {
      // Reset expired window
      memoryStore.set(key, { count: 1, resetTime: now + windowMs })
      return null
    }

    if (record.count >= max) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000)
      return NextResponse.json(
        { 
          success: false, 
          message: message,
          retryAfter 
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(max),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(record.resetTime / 1000))
          }
        }
      )
    }

    // Increment count
    record.count++
    return null
  }
}

// Export commonly used rate limiters
export const createStrictRateLimit = (max: number, windowMs: number) => rateLimit({
  max,
  windowMs,
  message: `Too many attempts. Maximum ${max} requests allowed per ${Math.floor(windowMs / 1000 / 60)} minutes.`
})

export const createAuthRateLimit = () => rateLimit({
  max: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: 'Too many authentication attempts. Please try again in 15 minutes.'
})

export const createAPIRateLimit = () => rateLimit({
  max: 100,
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: 'API rate limit exceeded. Please try again later.'
})
