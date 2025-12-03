import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    // Validate input
    if (!token) {
      return NextResponse.json(
        { 
          valid: false, 
          message: 'Token is required' 
        },
        { status: 400 }
      )
    }

    // Find all password reset tokens that haven't been used and haven't expired
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
    let validToken = null
    for (const dbToken of resetTokens) {
      const isMatch = await bcrypt.compare(token, dbToken.token)
      if (isMatch) {
        validToken = dbToken
        break
      }
    }

    if (!validToken) {
      return NextResponse.json({
        valid: false,
        message: 'Invalid or expired reset token'
      })
    }

    return NextResponse.json({
      valid: true,
      message: 'Token is valid'
    })

  } catch (error) {
    console.error('Token verification error:', error)
    
    return NextResponse.json(
      { 
        valid: false, 
        message: 'An error occurred while verifying the token' 
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
