/**
 * HomeShoppe Image Service Integration
 * Secure API-based integration with image service using API keys
 */

interface ImageUploadOptions {
  isPublic?: boolean
  alt?: string
  tags?: string[]
  category?: string
  entityType?: string
  productId?: string
  title?: string
}

interface ImageUploadResult {
  id: string
  filename: string
  url: string
  publicUrl: string
  size: number
  mimeType: string
  alt?: string
  tags?: string[]
  category?: string
  isPublic: boolean
  createdAt: string
}

interface PaginatedImageResult {
  images: ImageUploadResult[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

interface UsageStats {
  totalImages: number
  totalStorageUsed: number
  currentMonthUploads: number
  monthlyLimit: number
  storageLimit: number
}

class HomeshoppieImageService {
  private apiKey: string
  private apiSecret: string
  private baseUrl: string
  private accessToken: string | null = null
  private tokenExpiry: number | null = null

  constructor(apiKey: string, apiSecret: string, baseUrl: string = 'http://localhost:5000') {
    this.apiKey = apiKey
    this.apiSecret = apiSecret
    this.baseUrl = baseUrl
  }

  // Step 1: Authenticate and get access token
  async authenticate(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/applications/authenticate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: this.apiKey,
          apiSecret: this.apiSecret
        })
      })

      const result = await response.json()
      
      if (result.success) {
        this.accessToken = result.data.accessToken
        // JWT tokens expire in 24 hours by default
        this.tokenExpiry = Date.now() + (24 * 60 * 60 * 1000)
        console.log('✅ Image service authentication successful')
        return true
      } else {
        console.error('❌ Image service authentication failed:', result.error)
        return false
      }
    } catch (error) {
      console.error('❌ Image service authentication error:', error)
      return false
    }
  }

  // Check if token is valid and refresh if needed
  private async ensureAuthenticated(): Promise<boolean> {
    if (!this.accessToken || !this.tokenExpiry || Date.now() >= this.tokenExpiry) {
      return await this.authenticate()
    }
    return true
  }

  // Step 2: Upload an image
  async uploadImage(file: File | Buffer, options: ImageUploadOptions = {}): Promise<ImageUploadResult> {
    if (!await this.ensureAuthenticated()) {
      throw new Error('Authentication failed')
    }

    try {
      const formData = new FormData()
      
      // Add the image file
      if (file instanceof File) {
        formData.append('image', file)
      } else {
        // Handle Buffer (for server-side uploads)
        formData.append('image', new Blob([file]), 'image.jpg')
      }

      // Add optional metadata
      formData.append('isPublic', options.isPublic !== false ? 'true' : 'false')
      formData.append('alt', options.alt || '')
      formData.append('title', options.title || '')
      
      if (options.tags) {
        formData.append('tags', JSON.stringify(options.tags))
      }
      
      if (options.category) {
        formData.append('category', options.category)
      }

      if (options.entityType) {
        formData.append('entityType', options.entityType)
      }

      if (options.productId) {
        formData.append('productId', options.productId)
      }

      console.log('📤 Uploading to:', `${this.baseUrl}/api/images/upload`)
      
      const response = await fetch(`${this.baseUrl}/api/images/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      console.log('📥 Upload response:', JSON.stringify(result, null, 2))
      
      if (result.success) {
        // Handle different possible response structures
        const imageData = result.data?.image || result.data || result.image
        
        if (!imageData) {
          throw new Error('Invalid response structure: no image data found')
        }
        
        console.log('✅ Image uploaded successfully:', imageData.filename || imageData.originalName || 'unknown')
        return imageData
      } else {
        const errorMsg = result.error || result.message || 'Unknown upload error'
        console.error('❌ Upload failed:', errorMsg)
        throw new Error(errorMsg)
      }
    } catch (error) {
      console.error('❌ Upload error:', error)
      
      // Provide more specific error messages
      if (error instanceof TypeError && error.message.includes('filename')) {
        throw new Error('Upload response format error - please check image service compatibility')
      }
      
      throw error
    }
  }

  // Step 3: Get all images
  async getImages(options: {
    page?: number
    limit?: number
    tags?: string
    isPublic?: boolean
    category?: string
    entityType?: string
    productId?: string
  } = {}): Promise<PaginatedImageResult> {
    if (!await this.ensureAuthenticated()) {
      throw new Error('Authentication failed')
    }

    try {
      const params = new URLSearchParams()
      
      if (options.page) params.append('page', options.page.toString())
      if (options.limit) params.append('limit', options.limit.toString())
      if (options.tags) params.append('tags', options.tags)
      if (options.isPublic !== undefined) params.append('isPublic', options.isPublic.toString())
      if (options.category) params.append('category', options.category)
      if (options.entityType) params.append('entityType', options.entityType)
      if (options.productId) params.append('productId', options.productId)

      const url = `${this.baseUrl}/api/images?${params.toString()}`
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${this.accessToken}` }
      })

      const result = await response.json()
      
      if (result.success) {
        console.log(`✅ Retrieved ${result.data.images.length} images`)
        return result.data
      } else {
        console.error('❌ Get images failed:', result.error)
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('❌ Get images error:', error)
      throw error
    }
  }

  // Step 4: Get single image
  async getImage(imageId: string): Promise<ImageUploadResult> {
    if (!await this.ensureAuthenticated()) {
      throw new Error('Authentication failed')
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/images/${imageId}`, {
        headers: { 'Authorization': `Bearer ${this.accessToken}` }
      })

      const result = await response.json()
      
      if (result.success) {
        console.log('✅ Image retrieved:', result.data.image.filename)
        return result.data.image
      } else {
        console.error('❌ Get image failed:', result.error)
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('❌ Get image error:', error)
      throw error
    }
  }

  // Step 5: Delete an image
  async deleteImage(imageId: string): Promise<boolean> {
    if (!await this.ensureAuthenticated()) {
      throw new Error('Authentication failed')
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/images/${imageId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.accessToken}` }
      })

      const result = await response.json()
      
      if (result.success) {
        console.log('✅ Image deleted successfully')
        return true
      } else {
        console.error('❌ Delete failed:', result.error)
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('❌ Delete error:', error)
      throw error
    }
  }

  // Get application usage statistics
  async getUsageStats(): Promise<UsageStats> {
    if (!await this.ensureAuthenticated()) {
      throw new Error('Authentication failed')
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/applications/profile`, {
        headers: { 'Authorization': `Bearer ${this.accessToken}` }
      })

      const result = await response.json()
      
      if (result.success) {
        return result.data.application.usage
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('❌ Usage stats error:', error)
      throw error
    }
  }

  // Get image stream (for serving images)
  async getImageStream(imageId: string, size?: 'thumbnail' | 'small' | 'medium' | 'large' | 'original'): Promise<Response> {
    if (!await this.ensureAuthenticated()) {
      throw new Error('Authentication failed')
    }

    try {
      const params = size ? `?size=${size}` : ''
      const response = await fetch(`${this.baseUrl}/api/images/${imageId}/stream${params}`, {
        headers: { 'Authorization': `Bearer ${this.accessToken}` }
      })

      if (!response.ok) {
        throw new Error(`Failed to get image stream: ${response.statusText}`)
      }

      return response
    } catch (error) {
      console.error('❌ Get image stream error:', error)
      throw error
    }
  }

  // Get public image URL (no authentication required)
  getPublicImageUrl(imageId: string, size?: 'thumbnail' | 'small' | 'medium' | 'large' | 'original'): string {
    const params = size ? `?size=${size}` : ''
    return `${this.baseUrl}/api/public/images/${imageId}${params}`
  }
}

// Create singleton instance
const imageService = new HomeshoppieImageService(
  process.env.IMAGE_SERVICE_API_KEY || '',
  process.env.IMAGE_SERVICE_API_SECRET || '',
  process.env.IMAGE_SERVICE_BASE_URL || 'http://localhost:5000'
)

export { HomeshoppieImageService, imageService }
export type { ImageUploadOptions, ImageUploadResult, PaginatedImageResult, UsageStats }
