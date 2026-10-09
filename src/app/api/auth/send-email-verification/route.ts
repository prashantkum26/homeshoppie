import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import crypto from 'crypto'
import { sendEmail } from '@/lib/email'
import { buildVerificationEmail } from '@/lib/email-templates/verification-email'

// Rate limiter: 3 requests per 5 minutes per IP
const limiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3,
  message: 'Too many verification email requests. Please wait before requesting another verification email.'
})

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await limiter(request)
    if (rateLimitResult) {
      return rateLimitResult
    }

    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const { email } = await request.json()

    // Validate input
    if (!email || typeof email !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Valid email is required'
      }, { status: 400 })
    }

    // Verify the email belongs to the current user
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        isActive: true
      }
    })

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 })
    }

    if (!user.isActive) {
      return NextResponse.json({
        success: false,
        error: 'Account is inactive'
      }, { status: 403 })
    }

    if (user.email !== email) {
      return NextResponse.json({
        success: false,
        error: 'Email does not match your account'
      }, { status: 400 })
    }

    if (user.emailVerified) {
      return NextResponse.json({
        success: false,
        error: 'Email is already verified'
      }, { status: 400 })
    }

    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    const baseUrl = process.env.NEXT_PUBLIC_URL || process.env.NEXTAUTH_URL

    if (!baseUrl) {
      console.error('Missing verification email base URL')

      await prisma.verificationToken.deleteMany({
        where: {
          identifier: user.email,
          token,
          type: 'EMAIL_VERIFICATION',
        },
      })

      return NextResponse.json(
        {
          success: false,
          error: 'Email verification is temporarily unavailable.',
        },
        { status: 503 }
      )
    }

    // Delete any existing email verification tokens for this user
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: user.email,
        type: 'EMAIL_VERIFICATION'
      }
    })

    // Create new verification token
    await prisma.verificationToken.create({
      data: {
        identifier: user.email,
        token,
        expires,
        type: 'EMAIL_VERIFICATION'
      }
    })

    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')
    const verificationUrl = `${normalizedBaseUrl}/auth/verify-email?token=${encodeURIComponent(token)}`

    const emailResult = await sendEmail({
      subject: "Verify your HomeShoppie account",
      to: user.email,
      html: buildVerificationEmail({ verificationUrl }),
    });

    if (!emailResult.success) {
      await prisma.verificationToken.deleteMany({
        where: {
          identifier: user.email,
          token,
          type: 'EMAIL_VERIFICATION',
        },
      })
      return NextResponse.json({
        success: false,
        error: 'Failed to send verification email. Please try again later.',
      }, { status: 503 })
    }

    // Log the activity
    try {
      const identifier = request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown'

      await prisma.userActivityLog.create({
        data: {
          userId: user.id,
          action: 'CREATE',
          resource: 'email_verification',
          metadata: {
            tokenExpires: expires.toISOString()
          },
          ipAddress: identifier
        }
      })
    } catch (logError) {
      console.error('Failed to log verification request:', logError)
    }

    return NextResponse.json({
      success: true,
      message: 'Verification email sent successfully'
    })

  } catch (error: any) {
    console.error('Send email verification error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}
