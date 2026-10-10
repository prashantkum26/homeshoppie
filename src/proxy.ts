
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

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

function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)

  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }

  return btoa(binary)
}

function buildCsp(nonce: string, isProd: boolean): string {
  const scriptSources = [
    "'self'",
    `'nonce-${nonce}'`,
    'https://checkout.razorpay.com',
  ]

  // Keep development tooling functional without weakening production CSP.
  if (!isProd) {
    scriptSources.push("'unsafe-eval'")
  }

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' https://api.razorpay.com",
    `script-src ${scriptSources.join(' ')}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    [
      "connect-src 'self'",
      'https://api.razorpay.com',
      'https://checkout.razorpay.com',
    ].join(' '),
    [
      "frame-src 'self'",
      'https://api.razorpay.com',
      'https://checkout.razorpay.com',
    ].join(' '),
  ]

  if (isProd) {
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
  response.headers.set('x-nonce', nonce)

  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set(
    'Referrer-Policy',
    'strict-origin-when-cross-origin',
  )
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(self)',
  )
  response.headers.set('X-DNS-Prefetch-Control', 'off')
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin')

  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    )
  }

  return response
}

function matchesRoute(
  pathname: string,
  routes: readonly string[],
): boolean {
  return routes.some(
    (route) =>
      pathname === route || pathname.startsWith(`${route}/`),
  )
}

export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const isProd = process.env.NODE_ENV === 'production'

  const nonce = generateNonce()
  const csp = buildCsp(nonce, isProd)

  // Forward the policy and nonce to Next.js rendering.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const next = (noCache = false) => {
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })

    if (noCache) {
      response.headers.set(
        'Cache-Control',
        'private, no-store, no-cache, must-revalidate',
      )
      response.headers.set('Pragma', 'no-cache')
      response.headers.set('Expires', '0')
    }

    return applySecurityHeaders(response, csp, nonce)
  }

  const redirect = (path: string, callbackUrl?: string) => {
    const url = request.nextUrl.clone()
    url.pathname = path
    url.search = ''

    if (callbackUrl) {
      url.searchParams.set('callbackUrl', callbackUrl)
    }

    return applySecurityHeaders(
      NextResponse.redirect(url),
      csp,
      nonce,
    )
  }

  // Reject malformed encoded paths.
  try {
    decodeURIComponent(pathname)
  } catch {
    return applySecurityHeaders(
      new NextResponse('Bad Request', { status: 400 }),
      csp,
      nonce,
    )
  }

  if (pathname.includes('//') || pathname.includes('%00')) {
    return applySecurityHeaders(
      new NextResponse('Bad Request', { status: 400 }),
      csp,
      nonce,
    )
  }

  // Exact same-origin validation for browser-originated mutations.
  if (
    pathname.startsWith('/api/') &&
    !pathname.startsWith('/api/auth/') &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
  ) {
    const origin = request.headers.get('origin')

    if (origin) {
      try {
        if (new URL(origin).origin !== request.nextUrl.origin) {
          return applySecurityHeaders(
            new NextResponse('CSRF Verification Failed', {
              status: 403,
            }),
            csp,
            nonce,
          )
        }
      } catch {
        return applySecurityHeaders(
          new NextResponse('Invalid Origin', { status: 403 }),
          csp,
          nonce,
        )
      }
    }
  }

  if (!matchesRoute(pathname, PROTECTED_ROUTES)) {
    return next()
  }

  const secret = process.env.NEXTAUTH_SECRET

  if (!secret) {
    return applySecurityHeaders(
      new NextResponse('Configuration Error', { status: 500 }),
      csp,
      nonce,
    )
  }

  let token

  try {
    token = await getToken({
      req: request,
      secret,
      secureCookie: request.nextUrl.protocol === 'https:',
    })
  } catch {
    token = null
  }

  if (!token?.sub) {
    return redirect(SIGN_IN_PATH, `${pathname}${search}`)
  }

  if (
    !token.emailVerified &&
    !pathname.startsWith(VERIFY_EMAIL_PATH)
  ) {
    return redirect(VERIFY_EMAIL_PATH)
  }

  if (
    token.emailVerified &&
    token.phone &&
    !token.phoneVerified &&
    !pathname.startsWith(VERIFY_PHONE_PATH)
  ) {
    return redirect(VERIFY_PHONE_PATH)
  }

  if (
    matchesRoute(pathname, ADMIN_ROUTES) &&
    token.role !== 'ADMIN'
  ) {
    return redirect('/')
  }

  return next(true)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|uploads|api/auth).*)',
  ],
}
