import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { rateLimit, getClientIP } from '@/lib/rate-limit'

const prisma = new PrismaClient()

// Rate limiting for password reset requests
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Maximum 5 password reset attempts per 15 minutes
  message: 'Too many password reset attempts. Please try again in 15 minutes.',
})

// Password validation function
function validatePassword(password: string): { valid: boolean; message?: string } {
  if (!password) {
    return { valid: false, message: 'Password is required' }
  }

  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' }
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' }
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' }
  }

  if (!/\d/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' }
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character' }
  }

  return { valid: true }
}

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await passwordResetLimiter(request)
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const { token, password } = await request.json()

    // Validate inputs
    if (!token) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Reset token is required' 
        },
        { status: 400 }
      )
    }

    if (!password) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'New password is required' 
        },
        { status: 400 }
      )
    }

    // Validate password strength
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { 
          success: false, 
          message: passwordValidation.message 
        },
        { status: 400 }
      )
    }

    // Find all valid password reset tokens that haven't been used and haven't expired
    const resetTokens = await prisma.verificationToken.findMany({
      where: {
        type: 'PASSWORD_RESET',
        used: false,
        expires: {
          gt: new Date()
        }
      }
    })

    // Check if any token matches the provided token
    let validTokenRecord = null
    for (const dbToken of resetTokens) {
      const isMatch = await bcrypt.compare(token, dbToken.token)
      if (isMatch) {
        validTokenRecord = dbToken
        break
      }
    }

    if (!validTokenRecord) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Invalid or expired reset token' 
        },
        { status: 400 }
      )
    }

    // Find the user associated with this token
    const user = await prisma.user.findUnique({
      where: { email: validTokenRecord.identifier },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        isActive: true,
        isLocked: true,
        lockUntil: true,
      }
    })

    if (!user) {
      // Mark token as used to prevent reuse
      await prisma.verificationToken.update({
        where: { id: validTokenRecord.id },
        data: { used: true, usedAt: new Date() }
      })

      return NextResponse.json(
        { 
          success: false, 
          message: 'User account not found' 
        },
        { status: 404 }
      )
    }

    // Check if user account is active
    if (!user.isActive) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Account is not active' 
        },
        { status: 403 }
      )
    }

    // Check if user account is locked
    if (user.isLocked && user.lockUntil && user.lockUntil > new Date()) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Account is temporarily locked until ${user.lockUntil.toLocaleString()}` 
        },
        { status: 423 }
      )
    }

    // Check if new password is different from current password
    if (user.passwordHash) {
      const isSamePassword = await bcrypt.compare(password, user.passwordHash)
      if (isSamePassword) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'New password must be different from your current password' 
          },
          { status: 400 }
        )
      }
    }

    // Hash the new password
    const saltRounds = 12
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // Update user password and related fields
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        passwordChangedAt: new Date(),
        failedLoginCount: 0, // Reset failed login count
        isLocked: false, // Unlock account if it was locked
        lockUntil: null,
        lockReason: null,
        updatedAt: new Date(),
      }
    })

    // Mark the reset token as used
    await prisma.verificationToken.update({
      where: { id: validTokenRecord.id },
      data: { 
        used: true, 
        usedAt: new Date() 
      }
    })

    // Clean up all other unused tokens for this user
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: user.email,
        type: 'PASSWORD_RESET',
        used: false,
        id: { not: validTokenRecord.id }
      }
    })

    // Log the security event
    await prisma.securityLog.create({
      data: {
        userId: user.id,
        action: 'PASSWORD_CHANGE',
        ipAddress: getClientIP(request),
        userAgent: request.headers.get('user-agent') || 'unknown',
        details: {
          method: 'password_reset',
          email: user.email,
          timestamp: new Date().toISOString(),
        },
        severity: 'LOW',
        blocked: false,
        resolved: true,
      }
    })

    console.log(`Password reset successfully for user: ${user.email}`)

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully. You can now sign in with your new password.'
    })

  } catch (error) {
    console.error('Reset password error:', error)
    
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
