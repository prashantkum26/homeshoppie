/**
 * Image Service Client for Homeshoppie
 * Handles communication with the secure image service API
 */

export interface ImageUploadResponse {
  imageId: string
  originalName: string
  filename: string
  size: number
  mimetype: string
  uploadedAt: string
  metadata: {
    width: number
    height: number
    format: string
    hasAlpha: boolean
  }
  variants: {
    thumbnail: ImageVariant
    small: ImageVariant
    medium: ImageVariant
    large: ImageVariant
    original: ImageVariant
  }
  category?: string
  tags?: string[]
  alt?: string
  title?: string
  accessUrl: string
  accessToken: string
  urls: {
    thumbnail: string
    small: string
    medium: string
    large: string
    original: string
  }
}

export interface ImageVariant {
  path: string
  size: number
  width: number
  height: number
  format: string
}

export interface BulkUploadResponse {
  uploaded: ImageUploadResponse[]
  errors: any[]
  summary: {
    total: number
    successful: number
    failed: number
  }
}

export interface ImageListResponse {
  images: ImageUploadResponse[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  filters?: any
}

class ImageServiceClient {
  private baseUrl: string
  private authToken: string | null = null

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_IMAGE_SERVICE_URL || 'http://localhost:3001/api'
  }

  setAuthToken(token: string) {
    this.authToken = token
  }

  private getHeaders(includeAuth: boolean = true): HeadersInit {
    const headers: HeadersInit = {}
    
    if (includeAuth && this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`
    }
    
    return headers
  }

  /**
   * Register a user in the image service
   */
  async register(username: string, email: string, password: string) {
    const response = await fetch(`${this.baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, email, password })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Registration failed')
    }

    const data = await response.json()
    this.authToken = data.data.accessToken
    return data.data
  }

  /**
   * Login to the image service
   */
  async login(email: string, password: string) {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Login failed')
    }

    const data = await response.json()
    this.authToken = data.data.accessToken
    return data.data
  }

  /**
   * Upload a single image
   */
  async uploadImage(
    file: File,
    options?: {
      entityId?: string
      entityType?: string
      productId?: string
      category?: string
      tags?: string[]
      alt?: string
      title?: string
    }
  ): Promise<ImageUploadResponse> {
    if (!this.authToken) {
      throw new Error('Authentication required. Please login first.')
    }

    const formData = new FormData()
    formData.append('image', file)
    
    if (options?.entityId) formData.append('entityId', options.entityId)
    if (options?.entityType) formData.append('entityType', options.entityType)
    if (options?.productId) formData.append('productId', options.productId)
    if (options?.category) formData.append('category', options.category)
    if (options?.tags) formData.append('tags', options.tags.join(','))
    if (options?.alt) formData.append('alt', options.alt)
    if (options?.title) formData.append('title', options.title)

    const response = await fetch(`${this.baseUrl}/images/upload`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Upload failed')
    }

    const data = await response.json()
    return data.data
  }

  /**
   * Upload multiple images at once
   */
  async uploadBulkImages(
    files: File[],
    options?: {
      entityId?: string
      entityType?: string
      productId?: string
      category?: string
    }
  ): Promise<BulkUploadResponse> {
    if (!this.authToken) {
      throw new Error('Authentication required. Please login first.')
    }

    const formData = new FormData()
    
    files.forEach(file => {
      formData.append('images[]', file)
    })
    
    if (options?.entityId) formData.append('entityId', options.entityId)
    if (options?.entityType) formData.append('entityType', options.entityType)
    if (options?.productId) formData.append('productId', options.productId)
    if (options?.category) formData.append('category', options.category)

    const response = await fetch(`${this.baseUrl}/images/bulk-upload`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Bulk upload failed')
    }

    const data = await response.json()
    return data.data
  }

  /**
   * Get list of images
   */
  async getImages(params?: {
    page?: number
    limit?: number
    entityId?: string
    entityType?: string
    productId?: string
    category?: string
    tags?: string
    search?: string
    sort?: string
  }): Promise<ImageListResponse> {
    if (!this.authToken) {
      throw new Error('Authentication required. Please login first.')
    }

    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.append('page', params.page.toString())
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.entityId) searchParams.append('entityId', params.entityId)
    if (params?.entityType) searchParams.append('entityType', params.entityType)
    if (params?.productId) searchParams.append('productId', params.productId)
    if (params?.category) searchParams.append('category', params.category)
    if (params?.tags) searchParams.append('tags', params.tags)
    if (params?.search) searchParams.append('search', params.search)
    if (params?.sort) searchParams.append('sort', params.sort)

    const response = await fetch(`${this.baseUrl}/images?${searchParams}`, {
      headers: this.getHeaders(true)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch images')
    }

    const data = await response.json()
    return data.data
  }

  /**
   * Delete an image
   */
  async deleteImage(imageId: string): Promise<void> {
    if (!this.authToken) {
      throw new Error('Authentication required. Please login first.')
    }

    const response = await fetch(`${this.baseUrl}/images/${imageId}`, {
      method: 'DELETE',
      headers: this.getHeaders(true)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete image')
    }
  }

  /**
   * Update image metadata
   */
  async updateImageMetadata(
    imageId: string,
    metadata: {
      category?: string
      tags?: string[]
      alt?: string
      title?: string
    }
  ): Promise<ImageUploadResponse> {
    if (!this.authToken) {
      throw new Error('Authentication required. Please login first.')
    }

    const response = await fetch(`${this.baseUrl}/images/${imageId}/metadata`, {
      method: 'PATCH',
      headers: {
        ...this.getHeaders(true),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update metadata')
    }

    const data = await response.json()
    return data.data
  }

  /**
   * Replace an existing image
   */
  async replaceImage(imageId: string, file: File): Promise<ImageUploadResponse> {
    if (!this.authToken) {
      throw new Error('Authentication required. Please login first.')
    }

    const formData = new FormData()
    formData.append('image', file)

    const response = await fetch(`${this.baseUrl}/images/${imageId}`, {
      method: 'PUT',
      headers: this.getHeaders(true),
      body: formData
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to replace image')
    }

    const data = await response.json()
    return data.data
  }

  /**
   * Get image URL with access token
   */
  getImageUrl(imageId: string, size: 'thumbnail' | 'small' | 'medium' | 'large' | 'original' = 'original'): string {
    return `${this.baseUrl}/images/${imageId}?size=${size}`
  }

  /**
   * Get image URL with access token for public access
   */
  getImageUrlWithToken(imageId: string, accessToken: string, size: 'thumbnail' | 'small' | 'medium' | 'large' | 'original' = 'original'): string {
    return `${this.baseUrl}/images/${imageId}?size=${size}&token=${accessToken}`
  }
}

// Create a singleton instance
export const imageService = new ImageServiceClient()

export default imageService
