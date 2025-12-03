import { NextRequest, NextResponse } from 'next/server'

// Get client IP address (Edge Runtime compatible)
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  return cfConnectingIP || realIP || 'unknown'
}

// Add security headers (Edge Runtime compatible)
function addSecurityHeaders(response: NextResponse): NextResponse {
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

// Next.js 16+ proxy function - default export for proxy.ts
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  console.log(`🛡️ Proxy intercepting: ${pathname}`)
  
  // Create response with security headers
  let response = NextResponse.next()
  response = addSecurityHeaders(response)
  
  // Get client IP and add to headers for route handlers to use
  const ipAddress = getClientIP(request)
  response.headers.set('x-client-ip', ipAddress)
  response.headers.set('x-pathname', pathname)
  
  // Protected routes that require authentication AND verification
  const protectedRoutes = ['/dashboard', '/orders', '/cart', '/checkout', '/admin']
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  
  // Verification routes (allow access without full verification)
  const verificationRoutes = ['/auth/verify', '/auth/verify-email', '/auth/verify-phone']
  const isVerificationRoute = verificationRoutes.some(route => pathname.startsWith(route))
  
  // Auth routes (login, signup, etc.)
  const authRoutes = ['/auth/signin', '/auth/signup', '/auth/forgot-password', '/auth/reset-password']
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route))
  
  if (isProtectedRoute) {
    console.log(`🔐 Protected route detected: ${pathname}`)
    
    // Check if user is authenticated first - NextAuth v5 uses different cookie names
    const sessionToken = request.cookies.get('authjs.session-token') || 
                         request.cookies.get('__Secure-authjs.session-token') ||
                         request.cookies.get('next-auth.session-token') || 
                         request.cookies.get('__Secure-next-auth.session-token')
    
    console.log('🍪 Available cookies:', Array.from(request.cookies.getAll()).map(c => c.name))
    console.log('🔑 Session token found:', sessionToken ? 'YES' : 'NO')
    
    if (!sessionToken) {
      console.log('❌ No session token found - redirecting to signin')
      const signInUrl = new URL('/auth/signin', request.url)
      signInUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(signInUrl)
    }
    
    console.log('✅ Session token found - checking verification status')
    
    // For authenticated users, check verification status
    try {
      const { auth } = await import('./lib/auth')
      const session = await auth()
      
      if (session?.user) {
        console.log(`👤 User session found: ${session.user.email}`)
        console.log(`📧 Email verified: ${session.user.emailVerified}`)
        console.log(`📱 Phone: ${session.user.phone}`)
        console.log(`📱 Phone verified: ${session.user.phoneVerified}`)
        
        // Check if email verification is required
        if (!session.user.emailVerified) {
          console.log('❌ Email not verified - redirecting to email verification')
          const verifyUrl = new URL('/auth/verify-email', request.url)
          return NextResponse.redirect(verifyUrl)
        }
        
        // Check if phone verification is required (if user has a phone number)
        if (session.user.phone && !session.user.phoneVerified) {
          console.log('❌ Phone not verified - redirecting to phone verification')
          const verifyUrl = new URL('/auth/verify-phone', request.url)
          return NextResponse.redirect(verifyUrl)
        }
        
        console.log('✅ All verifications complete - allowing access')
      } else {
        console.log('❌ No user session found despite token - redirecting to signin')
        const signInUrl = new URL('/auth/signin', request.url)
        signInUrl.searchParams.set('callbackUrl', pathname)
        return NextResponse.redirect(signInUrl)
      }
    } catch (error) {
      console.error('❌ Proxy verification check error:', error)
      // On error, redirect to signin to be safe
      const signInUrl = new URL('/auth/signin', request.url)
      signInUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(signInUrl)
    }
  }
  
  console.log(`✅ Request allowed: ${pathname}`)
  return response
}

// Configure which paths the proxy runs on - Next.js 16+ format
export const config = {
  matcher: [
    // Match all routes except static files and images
    '/((?!_next/static|_next/image|favicon.ico|uploads).*)',
  ]
}
