import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import sharp from 'sharp'

// Avatar configuration
const AVATAR_CONFIG = {
  size: 200,
  backgroundColor: '#f3f4f6',
  textColor: '#374151',
  fontSize: 80,
  fontFamily: 'Arial, sans-serif'
}

// Color palette for avatars
const AVATAR_COLORS = [
  { bg: '#ef4444', text: '#ffffff' }, // red
  { bg: '#f97316', text: '#ffffff' }, // orange
  { bg: '#eab308', text: '#ffffff' }, // yellow
  { bg: '#22c55e', text: '#ffffff' }, // green
  { bg: '#06b6d4', text: '#ffffff' }, // cyan
  { bg: '#3b82f6', text: '#ffffff' }, // blue
  { bg: '#8b5cf6', text: '#ffffff' }, // violet
  { bg: '#ec4899', text: '#ffffff' }, // pink
  { bg: '#6b7280', text: '#ffffff' }, // gray
  { bg: '#dc2626', text: '#ffffff' }  // red-600
]

// Get user initials from name
function getUserInitials(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') {
    return '?'
  }
  
  const words = name.trim().split(' ')
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase()
  }
  
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase()
}

// Get consistent color based on user ID
function getAvatarColor(userId: string): { bg: string; text: string } {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i)
    hash = hash & hash // Convert to 32bit integer
  }
  
  const index = Math.abs(hash) % AVATAR_COLORS.length
  return AVATAR_COLORS[index]
}

// Generate SVG avatar
function generateAvatarSVG(initials: string, color: { bg: string; text: string }): string {
  return `
    <svg width="${AVATAR_CONFIG.size}" height="${AVATAR_CONFIG.size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${AVATAR_CONFIG.size}" height="${AVATAR_CONFIG.size}" fill="${color.bg}" />
      <text 
        x="50%" 
        y="50%" 
        text-anchor="middle" 
        dominant-baseline="central" 
        font-family="${AVATAR_CONFIG.fontFamily}" 
        font-size="${AVATAR_CONFIG.fontSize}" 
        font-weight="600"
        fill="${color.text}"
      >${initials}</text>
    </svg>
  `.trim()
}

// GET generate avatar for user
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id
    const { searchParams } = new URL(request.url)
    const size = parseInt(searchParams.get('size') || '200')
    const format = searchParams.get('format') || 'png'

    // Validate size
    if (size < 32 || size > 512) {
      return NextResponse.json(
        { error: 'Size must be between 32 and 512 pixels' },
        { status: 400 }
      )
    }

    // Validate format
    if (!['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(format.toLowerCase())) {
      return NextResponse.json(
        { error: 'Invalid format. Supported: png, jpg, jpeg, webp, svg' },
        { status: 400 }
      )
    }

    // Get user information
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // If user has a profile picture, redirect to it
    if (user.image) {
      return NextResponse.redirect(new URL(user.image, request.url))
    }

    // Generate avatar
    const initials = getUserInitials(user.name || user.email)
    const color = getAvatarColor(user.id)
    
    // Update AVATAR_CONFIG size for this request
    const avatarConfig = { ...AVATAR_CONFIG, size }
    const fontSize = Math.floor(size * 0.4) // 40% of size
    
    const svgContent = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${size}" height="${size}" fill="${color.bg}" />
        <text 
          x="50%" 
          y="50%" 
          text-anchor="middle" 
          dominant-baseline="central" 
          font-family="${avatarConfig.fontFamily}" 
          font-size="${fontSize}" 
          font-weight="600"
          fill="${color.text}"
        >${initials}</text>
      </svg>
    `.trim()

    // Return SVG directly if requested
    if (format.toLowerCase() === 'svg') {
      return new NextResponse(svgContent, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
        }
      })
    }

    // Convert SVG to requested format using Sharp
    let imageBuffer
    try {
      const svgBuffer = Buffer.from(svgContent)
      let sharpInstance = sharp(svgBuffer).resize(size, size)

      switch (format.toLowerCase()) {
        case 'png':
          imageBuffer = await sharpInstance.png({ quality: 90 }).toBuffer()
          break
        case 'jpg':
        case 'jpeg':
          imageBuffer = await sharpInstance.jpeg({ quality: 90 }).toBuffer()
          break
        case 'webp':
          imageBuffer = await sharpInstance.webp({ quality: 90 }).toBuffer()
          break
        default:
          imageBuffer = await sharpInstance.png({ quality: 90 }).toBuffer()
      }
    } catch (error) {
      console.error('Error generating avatar image:', error)
      return NextResponse.json(
        { error: 'Failed to generate avatar' },
        { status: 500 }
      )
    }

    // Determine content type
    const contentTypes: { [key: string]: string } = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'webp': 'image/webp'
    }

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentTypes[format.toLowerCase()] || 'image/png',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Content-Length': imageBuffer.length.toString()
      }
    })

  } catch (error) {
    console.error('Error generating avatar:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
