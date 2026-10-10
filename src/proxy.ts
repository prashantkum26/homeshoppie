import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const IS_PRODUCTION = process.env.NODE_ENV === 'production'

const SIGN_IN_PATH = '/auth/signin'
const VERIFY_EMAIL_PATH = '/auth/verify-email'
const VERIFY_PHONE_PATH = '/auth/verify-phone'

const PROTECTED_ROUTES = [
  '/dashboard',
  '/orders',
  '/checkout',
  '/admin',
  '/cart',
] as const

const ADMIN_ROUTES = ['/admin'] as const

// This must exactly match your real Razorpay webhook endpoint.
// The webhook handler itself MUST verify Razorpay's signature.
const RAZORPAY_WEBHOOK_PATH = '/api/webhooks/razorpay'

/* -------------------------------------------------------------------------- */
/* Upstash Redis and rate limits                                              */
/* -------------------------------------------------------------------------- */

const redisUrl = process.env.UPSTASH_REDIS_REST_URL
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

const redis =
  redisUrl && redisToken
    ? new Redis({
        url: redisUrl,
        token: redisToken,
      })
    : null

const apiLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(120, '1 m'),
      prefix: 'homeshoppie:proxy:api',
      analytics: true,
    })
  : null

const authLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '10 m'),
      prefix: 'homeshoppie:proxy:auth',
      analytics: true,
    })
  : null

const otpLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '10 m'),
      prefix: 'homeshoppie:proxy:otp',
      analytics: true,
    })
  : null

const paymentLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(15, '1 m'),
      prefix: 'homeshoppie:proxy:payment',
      analytics: true,
    })
  : null

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)

  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }

  return btoa(binary)
}

function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`)
}

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => matchesRoute(pathname, route))
}

function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTES.some((route) => matchesRoute(pathname, route))
}

function isMutation(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())
}

function getAppOrigin(request: NextRequest): string | null {
  const configuredUrl = process.env.NEXTAUTH_URL

  if (configuredUrl) {
    try {
      return new URL(configuredUrl).origin
    } catch {
      return null
    }
  }

  // Only use request-derived origin as a development fallback.
  if (!IS_PRODUCTION) {
    return request.nextUrl.origin
  }

  return null
}

/**
 * Extracts IP for rate limiting. Checks Vercel-specific headers first,
 * then falls back to x-real-ip for custom VPS/Cloudflare setups.
 */
function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-vercel-forwarded-for') ??
    request.headers.get('x-real-ip')?.trim() ??
    'unknown'
  )
}

function getRateLimitCategory(pathname: string) {
  const normalized = pathname.toLowerCase()

  if (/(?:otp|verify-phone|verify-email|send-code|resend-code)/.test(normalized)) {
    return { limiter: otpLimiter, sensitive: true }
  }

  if (normalized.startsWith('/api/auth/') || matchesRoute(normalized, '/auth/signin')) {
    return { limiter: authLimiter, sensitive: true }
  }

  if (
    normalized.startsWith('/api/checkout') ||
    normalized.startsWith('/api/orders') ||
    normalized.startsWith('/api/razorpay')
  ) {
    return { limiter: paymentLimiter, sensitive: true }
  }

  return { limiter: apiLimiter, sensitive: false }
}

/* -------------------------------------------------------------------------- */
/* Content Security Policy and security headers                               */
/* -------------------------------------------------------------------------- */

function buildCsp(nonce: string, pathname: string): string {
  const needsRazorpay = pathname.startsWith('/checkout') || pathname.startsWith('/cart')
  
  // Route Isolation: Only allow unsafe-inline on pages that require Razorpay
  const scriptSrc = needsRazorpay
    ? `'self' 'unsafe-inline' https://checkout.razorpay.com https://api.razorpay.com`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`

  const directives = [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com data:`,
    `img-src 'self' data: blob: https:`,
    `connect-src 'self' https://api.razorpay.com https://checkout.razorpay.com`,
    `frame-src 'self' https://checkout.razorpay.com https://api.razorpay.com`,
    `manifest-src 'self'`,
    `worker-src 'self' blob:`,
  ]

  if (IS_PRODUCTION) {
    directives.push('upgrade-insecure-requests')
  }

  return directives.join('; ')
}

function applySecurityHeaders(
  response: NextResponse,
  csp: string,
  nonce: string,
): NextResponse {
  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.headers.set('X-DNS-Prefetch-Control', 'off')
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')

  if (IS_PRODUCTION) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  response.headers.set('x-nonce', nonce)
  return response
}

function createRedirect(
  request: NextRequest,
  destination: string,
  csp: string,
  nonce: string,
): NextResponse {
  const response = NextResponse.redirect(new URL(destination, request.url))
  return applySecurityHeaders(response, csp, nonce)
}

/* -------------------------------------------------------------------------- */
/* Main Middleware                                                            */
/* -------------------------------------------------------------------------- */

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const method = request.method.toUpperCase()

  const nonce = generateNonce()
  const csp = buildCsp(nonce, pathname)

  // Next.js needs the CSP and nonce in the forwarded request headers
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('Content-Security-Policy', csp)
  requestHeaders.set('x-nonce', nonce)

  const finish = (response: NextResponse) => applySecurityHeaders(response, csp, nonce)

  /* 1. Validate the configured production origin */
  if (IS_PRODUCTION && !getAppOrigin(request)) {
    return finish(
      NextResponse.json({ error: 'Server origin configuration is invalid.' }, { status: 500 })
    )
  }

  /* 2. CSRF protection for browser-facing mutation APIs */
  const isApiRoute = pathname.startsWith('/api/')
  const isNextAuthRoute = pathname.startsWith('/api/auth/')
  const isRazorpayWebhook = pathname === RAZORPAY_WEBHOOK_PATH

  if (isApiRoute && isMutation(method) && !isNextAuthRoute && !isRazorpayWebhook) {
    const origin = request.headers.get('origin')
    const expectedOrigin = getAppOrigin(request)

    if (!origin || !expectedOrigin || origin !== expectedOrigin) {
      return finish(
        NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
      )
    }
  }

  /* 3. Rate limiting */
  const shouldRateLimit = pathname.startsWith('/api/') || (pathname.startsWith('/auth/') && isMutation(method))

  if (shouldRateLimit && !isNextAuthRoute) {
    const { limiter, sensitive } = getRateLimitCategory(pathname)

    if (!limiter && sensitive && IS_PRODUCTION) {
      return finish(
        NextResponse.json({ error: 'Rate limiting is temporarily unavailable.' }, { status: 503 })
      )
    }

    if (limiter) {
      const ip = getClientIp(request)
      const key = `${ip}:${pathname}`

      try {
        const result = await limiter.limit(key)

        if (!result.success) {
          const response = NextResponse.json(
            { error: 'Too many requests. Please try again later.' },
            {
              status: 429,
              headers: {
                'Retry-After': String(
                  Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))
                ),
              },
            }
          )
          return finish(response)
        }
      } catch (error) {
        console.error('Upstash rate-limit request failed.')
        if (sensitive && IS_PRODUCTION) {
          return finish(
            NextResponse.json({ error: 'Request protection is temporarily unavailable.' }, { status: 503 })
          )
        }
      }
    }
  }

  /* 4. Protect pages requiring an authenticated session */
  if (isProtectedRoute(pathname)) {
    let token

    try {
      token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET!,
        secureCookie: IS_PRODUCTION,
      })
    } catch {
      token = null
    }

    if (!token) {
      const signInUrl = new URL(SIGN_IN_PATH, request.url)
      signInUrl.searchParams.set('callbackUrl', `${pathname}${request.nextUrl.search}`)
      return createRedirect(request, `${signInUrl.pathname}${signInUrl.search}`, csp, nonce)
    }

    if (token.emailVerified !== true) {
      return createRedirect(request, VERIFY_EMAIL_PATH, csp, nonce)
    }

    if (token.phoneVerified !== true) {
      return createRedirect(request, VERIFY_PHONE_PATH, csp, nonce)
    }

    if (isAdminRoute(pathname) && token.role !== 'ADMIN') {
      return createRedirect(request, '/', csp, nonce)
    }
  }

  /* 5. Continue with the CSP and nonce forwarded to Next.js */
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  return finish(response)
}

/* -------------------------------------------------------------------------- */
/* Route matcher                                                              */
/* -------------------------------------------------------------------------- */

export const config = {
  matcher: [
    /*
     * Skip framework static assets and public uploads.
     * Keep API routes matched so the proxy can apply API protections.
     */
    '/((?!_next/static|_next/image|favicon.ico|uploads/).*)',
  ],
}