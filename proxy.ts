import { NextRequest, NextResponse } from 'next/server'

// Add security headers (Edge Runtime compatible)
function addSecurityHeaders(response: NextResponse): NextResponse {
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY')
  
  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')
  
  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Content Security Policy. Razorpay requires its checkout script and iframe.
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: blob: https:; " +
    "connect-src 'self' https://api.razorpay.com https://checkout.razorpay.com; " +
    "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com;"
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
  response.headers.set('X-DNS-Prefetch-Control', 'off')
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin')
  
  return response
}

function redirectWithSecurityHeaders(url: URL): NextResponse {
  return addSecurityHeaders(NextResponse.redirect(url))
}

// Next.js 16+ proxy function - default export for proxy.ts
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Create response with security headers
  let response = NextResponse.next()
  response = addSecurityHeaders(response)
  
  // Protected routes that require authentication AND verification
  const protectedRoutes = ['/dashboard', '/orders', '/cart', '/checkout', '/admin']
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  
  // Verification routes (allow access without full verification)
  // const verificationRoutes = ['/auth/verify', '/auth/verify-email', '/auth/verify-phone']
  // const isVerificationRoute = verificationRoutes.some(route => pathname.startsWith(route))
  
  // Auth routes (login, signup, etc.)
  // const authRoutes = ['/auth/signin', '/auth/signup', '/auth/forgot-password', '/auth/reset-password']
  // const isAuthRoute = authRoutes.some(route => pathname.startsWith(route))
  
  if (isProtectedRoute) {
    // Check if user is authenticated first - NextAuth v5 uses different cookie names
    const sessionToken = request.cookies.get('authjs.session-token') || 
                         request.cookies.get('__Secure-authjs.session-token') ||
                         request.cookies.get('next-auth.session-token') || 
                         request.cookies.get('__Secure-next-auth.session-token')
    
    if (!sessionToken) {
      const signInUrl = new URL('/auth/signin', request.url)
      signInUrl.searchParams.set('callbackUrl', pathname)
      return redirectWithSecurityHeaders(signInUrl)
    }
    
    // For authenticated users, check verification status
    try {
      const { auth } = await import('./lib/auth')
      const session = await auth()
      
      if (session?.user) {
        // Check if email verification is required
        if (!session.user.emailVerified) {
          const verifyUrl = new URL('/auth/verify-email', request.url)
          return redirectWithSecurityHeaders(verifyUrl)
        }
        
        // Check if phone verification is required (if user has a phone number)
        if (session.user.phone && !session.user.phoneVerified) {
          const verifyUrl = new URL('/auth/verify-phone', request.url)
          return redirectWithSecurityHeaders(verifyUrl)
        }
        
      } else {
        const signInUrl = new URL('/auth/signin', request.url)
        signInUrl.searchParams.set('callbackUrl', pathname)
        return redirectWithSecurityHeaders(signInUrl)
      }
    } catch (error) {
      // On error, redirect to signin to be safe
      const signInUrl = new URL('/auth/signin', request.url)
      signInUrl.searchParams.set('callbackUrl', pathname)
      return redirectWithSecurityHeaders(signInUrl)
    }
  }
  
  return response
}

// Configure which paths the proxy runs on - Next.js 16+ format
export const config = {
  matcher: [
    // Match all routes except static files and images
    '/((?!_next/static|_next/image|favicon.ico|uploads).*)',
  ]
}
