import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, countryCode, password } = body

    // Validation
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      )
    }

    // Phone validation (if provided)
    if (phone) {
      // Import phone validation here to avoid issues
      const { validatePhoneNumber, isE164Format } = await import('@/lib/phoneValidation')
      
      if (!isE164Format(phone)) {
        // If not in E.164 format, validate with country code
        if (!countryCode) {
          return NextResponse.json(
            { error: 'Country code is required when providing a phone number' },
            { status: 400 }
          )
        }
        
        const validation = validatePhoneNumber(phone, countryCode)
        if (!validation.isValid) {
          return NextResponse.json(
            { error: validation.error || 'Invalid phone number' },
            { status: 400 }
          )
        }
      }
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Check if phone number already exists (if provided)
    if (phone) {
      const existingPhoneUser = await prisma.user.findFirst({
        where: { phone: phone }
      })
      
      if (existingPhoneUser) {
        return NextResponse.json(
          { error: 'User with this phone number already exists' },
          { status: 400 }
        )
      }
    }

    // Generate unique salt for this user
    const passwordSalt = crypto.randomBytes(32).toString('hex')
    
    // Combine password with salt before hashing
    const saltedPassword = password + passwordSalt
    const hashedPassword = await bcrypt.hash(saltedPassword, 12)

    // Create user with explicit salt
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone || null,
        phoneCountryCode: phone ? countryCode : null,
        passwordHash: hashedPassword,
        passwordSalt: passwordSalt,
        role: 'USER',
        // Set verification status - users need to verify before login
        emailVerified: null, // Will be set when email is verified
        phoneVerified: null, // Will be set when phone is verified
      }
    })

    console.log(`User created with explicit salt: ${email}`)

    // TODO: Send email verification
    // TODO: Send SMS verification (if phone provided)

    // Remove password fields from response
    const { passwordHash: _hash, passwordSalt: _salt, ...userWithoutPassword } = user

    return NextResponse.json({
      message: 'User created successfully',
      user: userWithoutPassword
    }, { status: 201 })

  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
