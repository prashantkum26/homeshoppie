import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import sharp from 'sharp'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

// Configuration for image upload
const UPLOAD_CONFIG = {
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
  uploadDir: 'public/uploads/profiles',
  sizes: {
    thumbnail: { width: 100, height: 100 },
    small: { width: 200, height: 200 },
    medium: { width: 400, height: 400 }
  }
}

// Utility function to generate secure filename
function generateSecureFilename(originalName: string, userId: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  const ext = path.extname(originalName).toLowerCase()
  return `${userId}_${timestamp}_${random}${ext}`
}

// Utility function to validate file
function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > UPLOAD_CONFIG.maxFileSize) {
    return {
      valid: false,
      error: `File size too large. Maximum allowed size is ${UPLOAD_CONFIG.maxFileSize / (1024 * 1024)}MB`
    }
  }

  // Check file type
  if (!UPLOAD_CONFIG.allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${UPLOAD_CONFIG.allowedTypes.join(', ')}`
    }
  }

  // Check file extension
  const ext = path.extname(file.name).toLowerCase()
  if (!UPLOAD_CONFIG.allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `Invalid file extension. Allowed extensions: ${UPLOAD_CONFIG.allowedExtensions.join(', ')}`
    }
  }

  return { valid: true }
}

// Utility function to create directory if not exists
async function ensureUploadDir(): Promise<void> {
  if (!existsSync(UPLOAD_CONFIG.uploadDir)) {
    await mkdir(UPLOAD_CONFIG.uploadDir, { recursive: true })
  }
}

// POST upload profile picture
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get form data
    const formData = await request.formData()
    const file = formData.get('image') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      )
    }

    // Validate file
    const validation = validateFile(file)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // Ensure upload directory exists
    await ensureUploadDir()

    // Generate secure filename
    const filename = generateSecureFilename(file.name, session.user.id)
    const baseFilename = path.parse(filename).name
    const extension = path.parse(filename).ext

    // Read file buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Verify image integrity and get metadata
    let imageInfo
    try {
      imageInfo = await sharp(buffer).metadata()
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid or corrupted image file' },
        { status: 400 }
      )
    }

    // Additional security checks
    if (!imageInfo.width || !imageInfo.height) {
      return NextResponse.json(
        { error: 'Unable to determine image dimensions' },
        { status: 400 }
      )
    }

    if (imageInfo.width > 4000 || imageInfo.height > 4000) {
      return NextResponse.json(
        { error: 'Image dimensions too large. Maximum 4000x4000 pixels' },
        { status: 400 }
      )
    }

    // Process and save images in different sizes
    const imagePaths = {
      original: path.join(UPLOAD_CONFIG.uploadDir, filename),
      thumbnail: path.join(UPLOAD_CONFIG.uploadDir, `${baseFilename}_thumb${extension}`),
      small: path.join(UPLOAD_CONFIG.uploadDir, `${baseFilename}_small${extension}`),
      medium: path.join(UPLOAD_CONFIG.uploadDir, `${baseFilename}_medium${extension}`)
    }

    const imageUrls = {
      original: `/uploads/profiles/${filename}`,
      thumbnail: `/uploads/profiles/${baseFilename}_thumb${extension}`,
      small: `/uploads/profiles/${baseFilename}_small${extension}`,
      medium: `/uploads/profiles/${baseFilename}_medium${extension}`
    }

    try {
      // Save original (optimized)
      await sharp(buffer)
        .jpeg({ quality: 90, mozjpeg: true })
        .png({ quality: 90, compressionLevel: 9 })
        .webp({ quality: 90 })
        .toFile(imagePaths.original)

      // Save thumbnail
      await sharp(buffer)
        .resize(UPLOAD_CONFIG.sizes.thumbnail.width, UPLOAD_CONFIG.sizes.thumbnail.height, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 85 })
        .png({ quality: 85 })
        .webp({ quality: 85 })
        .toFile(imagePaths.thumbnail)

      // Save small
      await sharp(buffer)
        .resize(UPLOAD_CONFIG.sizes.small.width, UPLOAD_CONFIG.sizes.small.height, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 85 })
        .png({ quality: 85 })
        .webp({ quality: 85 })
        .toFile(imagePaths.small)

      // Save medium
      await sharp(buffer)
        .resize(UPLOAD_CONFIG.sizes.medium.width, UPLOAD_CONFIG.sizes.medium.height, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 85 })
        .png({ quality: 85 })
        .webp({ quality: 85 })
        .toFile(imagePaths.medium)

    } catch (error) {
      console.error('Error processing images:', error)
      return NextResponse.json(
        { error: 'Failed to process image' },
        { status: 500 }
      )
    }

    // Delete old profile pictures if they exist
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { image: true }
    })

    if (currentUser?.image) {
      try {
        // Extract filename from old image URL
        const oldImageUrl = currentUser.image
        if (oldImageUrl.startsWith('/uploads/profiles/')) {
          const oldFilename = path.basename(oldImageUrl)
          const oldBaseFilename = path.parse(oldFilename).name
          const oldExtension = path.parse(oldFilename).ext

          // Delete old files
          const oldFiles = [
            path.join(UPLOAD_CONFIG.uploadDir, oldFilename),
            path.join(UPLOAD_CONFIG.uploadDir, `${oldBaseFilename}_thumb${oldExtension}`),
            path.join(UPLOAD_CONFIG.uploadDir, `${oldBaseFilename}_small${oldExtension}`),
            path.join(UPLOAD_CONFIG.uploadDir, `${oldBaseFilename}_medium${oldExtension}`)
          ]

          for (const oldFile of oldFiles) {
            try {
              if (existsSync(oldFile)) {
                await unlink(oldFile)
              }
            } catch (deleteError) {
              console.warn('Failed to delete old image file:', oldFile, deleteError)
            }
          }
        }
      } catch (error) {
        console.warn('Failed to clean up old profile pictures:', error)
      }
    }

    // Update user profile with new image
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { image: imageUrls.medium }, // Use medium size as default
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        updatedAt: true
      }
    })

    return NextResponse.json({
      message: 'Profile picture uploaded successfully',
      user: updatedUser,
      images: imageUrls,
      metadata: {
        originalSize: file.size,
        dimensions: {
          width: imageInfo.width,
          height: imageInfo.height
        },
        format: imageInfo.format
      }
    })

  } catch (error) {
    console.error('Error uploading profile picture:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE remove profile picture
export async function DELETE() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user profile
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { image: true }
    })

    if (!currentUser?.image) {
      return NextResponse.json(
        { error: 'No profile picture to delete' },
        { status: 400 }
      )
    }

    // Delete image files
    if (currentUser.image.startsWith('/uploads/profiles/')) {
      try {
        const filename = path.basename(currentUser.image)
        const baseFilename = path.parse(filename).name
        const extension = path.parse(filename).ext

        const filesToDelete = [
          path.join(UPLOAD_CONFIG.uploadDir, filename),
          path.join(UPLOAD_CONFIG.uploadDir, `${baseFilename}_thumb${extension}`),
          path.join(UPLOAD_CONFIG.uploadDir, `${baseFilename}_small${extension}`),
          path.join(UPLOAD_CONFIG.uploadDir, `${baseFilename}_medium${extension}`)
        ]

        for (const file of filesToDelete) {
          try {
            if (existsSync(file)) {
              await unlink(file)
            }
          } catch (deleteError) {
            console.warn('Failed to delete image file:', file, deleteError)
          }
        }
      } catch (error) {
        console.warn('Failed to delete profile picture files:', error)
      }
    }

    // Update user profile to remove image
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { image: null },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        updatedAt: true
      }
    })

    return NextResponse.json({
      message: 'Profile picture deleted successfully',
      user: updatedUser
    })

  } catch (error) {
    console.error('Error deleting profile picture:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
