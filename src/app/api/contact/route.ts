import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSession } from 'next-auth/react'
import { getClientIP } from '@/lib/rate-limit'
import { isValidEmail, isValidPhone } from '@/lib/utils'

const prisma = new PrismaClient()

// Contact message rate limiting - 5 messages per day per IP
const DAILY_MESSAGE_LIMIT = 5

export async function POST(request: NextRequest) {
  try {
    const { name, email, phone, subject, message, category } = await request.json()
    
    // Input validation
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Name, email, subject, and message are required' 
        },
        { status: 400 }
      )
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Please enter a valid email address' 
        },
        { status: 400 }
      )
    }

    // Validate phone if provided
    if (phone && !isValidPhone(phone)) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Please enter a valid phone number' 
        },
        { status: 400 }
      )
    }

    // Validate message length
    if (message.length < 10) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Message must be at least 10 characters long' 
        },
        { status: 400 }
      )
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Message must be less than 2000 characters' 
        },
        { status: 400 }
      )
    }

    const clientIP = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || 'unknown'
    
    // Check daily rate limit for this IP
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todaysMessages = await prisma.contactMessage.count({
      where: {
        ipAddress: clientIP,
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    })

    if (todaysMessages >= DAILY_MESSAGE_LIMIT) {
      return NextResponse.json(
        { 
          success: false, 
          message: `You have reached the daily limit of ${DAILY_MESSAGE_LIMIT} messages. Please try again tomorrow.`,
          retryAfter: Math.ceil((tomorrow.getTime() - Date.now()) / 1000) // seconds until tomorrow
        },
        { status: 429 }
      )
    }

    // Check if user is logged in
    let userId: string | null = null
    try {
      // Note: getSession() works on client side, we need a different approach for server side
      // We'll get user ID from the session token if available
      const sessionToken = request.cookies.get('next-auth.session-token')?.value ||
                           request.cookies.get('__Secure-next-auth.session-token')?.value

      if (sessionToken) {
        const session = await prisma.session.findUnique({
          where: { sessionToken },
          include: { user: true }
        })
        
        if (session && (!session.expires || session.expires > new Date())) {
          userId = session.userId
        }
      }
    } catch (error) {
      // If we can't get the session, continue without user association
      console.log('Could not get user session for contact message:', error)
    }

    // Determine message priority based on content and category
    let priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' = 'NORMAL'
    
    const urgentKeywords = ['urgent', 'emergency', 'asap', 'immediately', 'critical', 'broken', 'not working', 'error', 'bug']
    const highKeywords = ['important', 'soon', 'quickly', 'problem', 'issue', 'complaint']
    
    const messageText = (subject + ' ' + message).toLowerCase()
    
    if (urgentKeywords.some(keyword => messageText.includes(keyword))) {
      priority = 'URGENT'
    } else if (highKeywords.some(keyword => messageText.includes(keyword))) {
      priority = 'HIGH'
    } else if (category === 'COMPLAINT' || category === 'TECHNICAL_ISSUE') {
      priority = 'HIGH'
    } else if (category === 'BULK_ORDER' || category === 'PARTNERSHIP') {
      priority = 'HIGH'
    }

    // Create contact message
    const contactMessage = await prisma.contactMessage.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim() || null,
        subject: subject.trim(),
        message: message.trim(),
        category: category || 'GENERAL',
        priority,
        ipAddress: clientIP,
        userAgent,
        dailyCount: todaysMessages + 1,
        userId,
        status: 'NEW'
      }
    })

    // Log successful contact message creation
    console.log(`Contact message created: ${contactMessage.id} from IP: ${clientIP}`)

    // TODO: Send notification email to admin team
    // TODO: Auto-categorize message using AI/ML
    
    return NextResponse.json({
      success: true,
      message: 'Thank you for your message! We will get back to you within 24 hours.',
      messageId: contactMessage.id,
      priority: priority.toLowerCase()
    })

  } catch (error) {
    console.error('Contact message error:', error)
    
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

// Get contact messages (admin only)
export async function GET(request: NextRequest) {
  try {
    // Check if user is admin (simplified check for now)
    const sessionToken = request.cookies.get('next-auth.session-token')?.value ||
                         request.cookies.get('__Secure-next-auth.session-token')?.value

    if (!sessionToken) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: { user: true }
    })

    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { message: 'Forbidden' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const priority = searchParams.get('priority')

    const skip = (page - 1) * limit

    const where: any = {}
    if (status) where.status = status
    if (category) where.category = category
    if (priority) where.priority = priority

    const [messages, total] = await Promise.all([
      prisma.contactMessage.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ],
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      }),
      prisma.contactMessage.count({ where })
    ])

    return NextResponse.json({
      success: true,
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Get contact messages error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'An error occurred while fetching messages' 
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

// Handle unsupported methods
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
