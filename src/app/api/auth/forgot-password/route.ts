import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { sendPasswordResetEmail } from '@/lib/email'
import { rateLimit, getClientIP } from '@/lib/rate-limit'

const prisma = new PrismaClient()

// Rate limiting for password reset requests
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Maximum 3 password reset attempts per 15 minutes
  message: 'Too many password reset attempts. Please try again in 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
})

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await passwordResetLimiter(request)
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const { email } = await request.json()

    // Validate input
    if (!email) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Email is required' 
        },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Please enter a valid email address' 
        },
        { status: 400 }
      )
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        isLocked: true,
        lockUntil: true,
      }
    })

    // For security, always return success even if user doesn't exist
    // This prevents email enumeration attacks
    if (!user) {
      console.log(`Password reset attempted for non-existent email: ${email}`)
      return NextResponse.json({
        success: true,
        message: 'If an account with this email exists, you will receive a password reset link shortly.'
      })
    }

    // Check if user account is active
    if (!user.isActive) {
      console.log(`Password reset attempted for inactive account: ${email}`)
      return NextResponse.json({
        success: true,
        message: 'If an account with this email exists, you will receive a password reset link shortly.'
      })
    }

    // Check if user account is locked
    if (user.isLocked && user.lockUntil && user.lockUntil > new Date()) {
      console.log(`Password reset attempted for locked account: ${email}`)
      return NextResponse.json(
        { 
          success: false, 
          message: `Account is temporarily locked. Please try again after ${user.lockUntil.toLocaleString()}.` 
        },
        { status: 423 } // 423 Locked
      )
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const hashedToken = await bcrypt.hash(resetToken, 12)
    
    // Token expires in 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    // Store reset token in database
    await prisma.verificationToken.create({
      data: {
        identifier: user.email,
        token: hashedToken,
        expires: expiresAt,
        type: 'PASSWORD_RESET',
        used: false,
      }
    })

    // Clean up old unused tokens for this user
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: user.email,
        type: 'PASSWORD_RESET',
        OR: [
          { expires: { lt: new Date() } }, // Expired tokens
          { used: true }, // Used tokens
        ]
      }
    })

    // Send password reset email
    try {
      const emailResult = await sendPasswordResetEmail(user.email, resetToken, user.name || undefined)
      
      if (!emailResult.success) {
        console.error('Failed to send password reset email:', emailResult.error)
        
        // Clean up the token since email failed
        await prisma.verificationToken.deleteMany({
          where: {
            identifier: user.email,
            token: hashedToken,
          }
        })
        
        return NextResponse.json(
          { 
            success: false, 
            message: 'Failed to send reset email. Please try again later.' 
          },
          { status: 500 }
        )
      }

      console.log(`Password reset email sent successfully to: ${user.email}`)

      // Log the security event
      await prisma.securityLog.create({
        data: {
          userId: user.id,
          action: 'PASSWORD_CHANGE',
          ipAddress: getClientIP(request),
          userAgent: request.headers.get('user-agent') || 'unknown',
          details: {
            email: user.email,
            timestamp: new Date().toISOString(),
          },
          severity: 'LOW',
          blocked: false,
          resolved: false,
        }
      })

      return NextResponse.json({
        success: true,
        message: 'If an account with this email exists, you will receive a password reset link shortly.'
      })

    } catch (emailError) {
      console.error('Error sending password reset email:', emailError)
      
      // Clean up the token since email failed
      await prisma.verificationToken.deleteMany({
        where: {
          identifier: user.email,
          token: hashedToken,
        }
      })
      
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to send reset email. Please try again later.' 
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Forgot password error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'An unexpected error occurred. Please try again later.' 
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { message: 'Method not allowed' },
    { status: 405 }
  )
}

export async function PUT() {
  return NextResponse.json(
    { message: 'Method not allowed' },
    { status: 405 }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { message: 'Method not allowed' },
    { status: 405 }
  )
}
