import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// ============================================================
// Enterprise Security Middleware
// Next.js 16 + NextAuth.js v4 + JWT (Edge Compatible)
// ============================================================

const SIGN_IN_PATH = '/auth/signin'
const VERIFY_EMAIL_PATH = '/auth/verify-email'
const VERIFY_PHONE_PATH = '/auth/verify-phone'

const PROTECTED_ROUTES = ['/dashboard', '/orders', '/checkout', '/admin', '/cart'] as const
const ADMIN_ROUTES = ['/admin'] as const

// ============================================================
// 1. Attack Mitigation: Strict Security Headers (XSS, Clickjacking, Sniffing)
// ============================================================
function applySecurityHeaders(response: NextResponse, _request: NextRequest): NextResponse {
  const isProd = process.env.NODE_ENV === 'production'
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  
  // Set nonce in headers for use in Server Components
  response.headers.set('x-nonce', nonce)

  const scriptSrc = isProd
    ? `'self' 'nonce-${nonce}' 'strict-dynamic' https://checkout.razorpay.com`
    : `'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com`

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
    "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
    "upgrade-insecure-requests"
  ].join('; ')

  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self)')
  response.headers.set('X-DNS-Prefetch-Control', 'off')
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin')

  if (isProd) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }

  return response
}

// ============================================================
// Response Helpers
// ============================================================
function redirectTo(request: NextRequest, pathname: string, callbackUrl?: string): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  if (callbackUrl) url.searchParams.set('callbackUrl', callbackUrl)
  return applySecurityHeaders(NextResponse.redirect(url), request)
}

function matchesRoute(pathname: string, routes: readonly string[]): boolean {
  return routes.some(route => pathname === route || pathname.startsWith(`${route}/`))
}

export default async function middleware(request: NextRequest) {
  const { pathname, search, origin } = request.nextUrl

  // ============================================================
  // 2. Attack Mitigation: URL Normalization (Path Traversal)
  // ============================================================
  try {
    decodeURIComponent(pathname)
  } catch (e) {
    return new NextResponse('Bad Request', { status: 400 })
  }
  
  if (pathname.includes('//') || pathname.includes('%00')) {
    const cleanUrl = request.nextUrl.clone()
    cleanUrl.pathname = pathname.replace(/\/+/g, '/').replace(/%00/g, '')
    return NextResponse.redirect(cleanUrl)
  }

  // ============================================================
  // 3. Attack Mitigation: CSRF Origin Check for API Mutations
  // ============================================================
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) {
    const method = request.method
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const requestOrigin = request.headers.get('origin')
      const requestHost = request.headers.get('host')
      
      // Ensure the request originates from your actual domain
      if (requestOrigin && !requestOrigin.includes(requestHost || '')) {
        return new NextResponse('CSRF Verification Failed', { status: 403 })
      }
    }
  }

  // Public routes pass through, applying security headers
  if (!matchesRoute(pathname, PROTECTED_ROUTES)) {
    return applySecurityHeaders(NextResponse.next(), request)
  }

  // ============================================================
  // 4. Attack Mitigation: Cache Poisoning on Protected Routes
  // ============================================================
  const continueResponse = () => {
    const response = NextResponse.next()
    response.headers.set('Cache-Control', 'private, no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return applySecurityHeaders(response, request)
  }

  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    return new NextResponse('Configuration Error', { status: 500 })
  }

  // ============================================================
  // 5. Attack Mitigation: Edge-safe JWT Session Validation
  // ============================================================
  let token
  try {
    const configuredUrl = process.env.NEXTAUTH_URL
    const secureCookie = configuredUrl
      ? configuredUrl.startsWith('https://')
      : request.nextUrl.protocol === 'https:'

    token = await getToken({
      req: request,
      secret,
      secureCookie,
    })
  } catch {
    token = null
  }

  // Unauthenticated
  if (!token?.sub) {
    return redirectTo(request, SIGN_IN_PATH, `${pathname}${search}`)
  }

  // Verification Checks
  if (!token.emailVerified && !pathname.startsWith(VERIFY_EMAIL_PATH)) {
    return redirectTo(request, VERIFY_EMAIL_PATH)
  }

  if (token.emailVerified && token.phone && !token.phoneVerified && !pathname.startsWith(VERIFY_PHONE_PATH)) {
    return redirectTo(request, VERIFY_PHONE_PATH)
  }

  // Privilege Escalation Check (RBAC)
  if (matchesRoute(pathname, ADMIN_ROUTES) && token.role !== 'ADMIN') {
    return redirectTo(request, '/')
  }

  return continueResponse()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - uploads (public user uploads)
     * - api/auth (NextAuth endpoints)
     */
    '/((?!_next/static|_next/image|favicon.ico|uploads|api/auth).*)',
  ],
}