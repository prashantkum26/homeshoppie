import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'

// Rate limiter: 10 verification attempts per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many verification attempts. Please wait before trying again.'
})

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await limiter(request)
    if (rateLimitResult) {
      return rateLimitResult
    }

    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    // Validate token parameter
    if (!token || typeof token !== 'string' || token.length !== 64) {
      return NextResponse.json({
        success: false,
        error: 'Invalid verification token'
      }, { status: 400 })
    }

    // Find the verification token
    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        token,
        type: 'EMAIL_VERIFICATION'
      }
    })

    if (!verificationToken) {
      return NextResponse.json({
        success: false,
        error: 'Invalid or expired verification token'
      }, { status: 400 })
    }

    // Check if token has expired
    if (verificationToken.expires < new Date()) {
      // Delete expired token
      await prisma.verificationToken.delete({
        where: { id: verificationToken.id }
      })
      
      return NextResponse.json({
        success: false,
        error: 'Verification token has expired. Please request a new one.'
      }, { status: 400 })
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: {
        email: verificationToken.identifier
      },
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

    // Check if email is already verified
    if (user.emailVerified) {
      // Clean up the token
      await prisma.verificationToken.delete({
        where: { id: verificationToken.id }
      })
      
      return NextResponse.json({
        success: false,
        error: 'Email is already verified'
      }, { status: 400 })
    }

    // Verify the email
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        updatedAt: new Date()
      },
      select: {
        id: true,
        email: true,
        emailVerified: true
      }
    })

    // Delete the used verification token
    await prisma.verificationToken.delete({
      where: { id: verificationToken.id }
    })

    // Log the successful verification
    try {
      const identifier = request.headers.get('x-forwarded-for') || 
                        request.headers.get('x-real-ip') || 
                        'unknown'

      await prisma.userActivityLog.create({
        data: {
          userId: user.id,
          action: 'UPDATE',
          resource: 'email_verification',
          metadata: {
            email: user.email,
            verifiedAt: updatedUser.emailVerified?.toISOString(),
            tokenUsed: true
          },
          ipAddress: identifier
        }
      })
    } catch (logError) {
      console.error('Failed to log email verification:', logError)
    }

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
      data: {
        email: updatedUser.email,
        verifiedAt: updatedUser.emailVerified
      }
    })

  } catch (error: any) {
    console.error('Email verification error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// Handle unsupported methods
export async function POST() {
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
