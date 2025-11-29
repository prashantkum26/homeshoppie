'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { PhotoIcon, XMarkIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface ProductImage {
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

interface ProductImageManagerProps {
  productId: string
  maxImages?: number
  onImagesChange?: (images: ProductImage[]) => void
}

export default function ProductImageManager({
  productId,
  maxImages = 10,
  onImagesChange
}: ProductImageManagerProps) {
  const [images, setImages] = useState<ProductImage[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)

  // Load existing images for the product
  useEffect(() => {
    loadProductImages()
  }, [productId])

  const loadProductImages = async () => {
    if (!productId) return
    
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/products/${productId}/images`)
      const result = await response.json()
      
      if (result.success) {
        setImages(result.images)
        onImagesChange?.(result.images)
      }
    } catch (error) {
      console.error('Failed to load product images:', error)
    } finally {
      setLoading(false)
    }
  }

  // Upload new images
  const handleImageUpload = async (files: FileList) => {
    if (files.length === 0) return
    
    const fileArray = Array.from(files)
    
    // Validate files
    const validFiles = fileArray.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image file`)
        return false
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error(`${file.name} is too large. Maximum size is 5MB`)
        return false
      }
      return true
    })

    if (validFiles.length === 0) return

    // Check image limit
    if (images.length + validFiles.length > maxImages) {
      toast.error(`Cannot upload more than ${maxImages} images`)
      return
    }

    setUploading(true)

    try {
      const uploadPromises = validFiles.map(async (file) => {
        const formData = new FormData()
        formData.append('image', file)
        formData.append('productId', productId)
        formData.append('category', 'product')
        formData.append('entityType', 'product')
        formData.append('alt', `${productId} product image`)
        formData.append('title', file.name)
        formData.append('tags', JSON.stringify(['product', 'homeshoppie']))

        const response = await fetch('/api/images/upload', {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Upload failed')
        }

        return response.json()
      })

      const results = await Promise.all(uploadPromises)
      const newImages = results.map(result => ({
        id: result.data.imageId,
        filename: result.data.filename,
        url: result.data.url,
        publicUrl: result.data.publicUrl,
        size: result.data.size,
        mimeType: result.data.mimeType,
        alt: `${productId} product image`,
        tags: ['product', 'homeshoppie'],
        category: 'product',
        isPublic: true,
        createdAt: result.data.uploadedAt
      }))

      const updatedImages = [...images, ...newImages]
      setImages(updatedImages)
      onImagesChange?.(updatedImages)
      
      toast.success(`Successfully uploaded ${validFiles.length} image${validFiles.length > 1 ? 's' : ''}`)
    } catch (error) {
      console.error('Upload failed:', error)
      toast.error('Failed to upload images')
    } finally {
      setUploading(false)
    }
  }

  // Delete an image
  const handleImageDelete = async (imageId: string) => {
    try {
      // Include productId as query parameter for proper cleanup
      const deleteUrl = productId 
        ? `/api/admin/images/${imageId}?productId=${productId}`
        : `/api/admin/images/${imageId}`
      
      const response = await fetch(deleteUrl, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Delete failed')
      }

      const result = await response.json()
      
      // Update local state
      const updatedImages = images.filter(img => img.id !== imageId)
      setImages(updatedImages)
      onImagesChange?.(updatedImages)
      
      toast.success(result.message || 'Image deleted successfully')
      
      // Log the database update status
      if (result.databaseUpdated) {
        console.log('✅ Product database updated successfully')
      }
    } catch (error) {
      console.error('Delete failed:', error)
      toast.error('Failed to delete image')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Product Images</h3>
        <div className="text-sm text-gray-500">
          {images.length}/{maxImages} images
        </div>
      </div>

      {/* Upload Area */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-gray-400 transition-colors">
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
          className="hidden"
          id="image-upload"
          disabled={uploading || images.length >= maxImages}
        />
        
        <label
          htmlFor="image-upload"
          className={`cursor-pointer flex flex-col items-center justify-center ${
            uploading || images.length >= maxImages ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <PhotoIcon className="h-12 w-12 text-gray-400" />
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              {uploading ? 'Uploading...' : 'Click to upload images or drag and drop'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              PNG, JPG, WebP up to 5MB each
            </p>
          </div>
          
          {uploading && (
            <div className="mt-4">
              <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-md">
                <ArrowUpTrayIcon className="animate-pulse h-4 w-4 mr-2" />
                Uploading images...
              </div>
            </div>
          )}
        </label>
      </div>

      {/* Images Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : images.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image) => (
            <div key={image.id} className="relative group bg-gray-100 rounded-lg overflow-hidden">
              <div className="aspect-square">
                <Image
                  src={`/api/admin/images/${image.id}?size=thumbnail`}
                  alt={image.alt || image.filename}
                  fill
                  className="object-cover"
                  onError={() => console.error('Failed to load image:', image.id)}
                />
              </div>
              
              {/* Overlay with actions */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center">
                <button
                  onClick={() => handleImageDelete(image.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 text-white p-2 rounded-full hover:bg-red-700"
                  title="Delete image"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
              
              {/* Image info */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2">
                <p className="text-white text-xs truncate" title={image.filename}>
                  {image.filename}
                </p>
                <p className="text-gray-300 text-xs">
                  {(image.size / 1024).toFixed(1)} KB
                </p>
              </div>
              
              {/* Public indicator */}
              {image.isPublic && (
                <div className="absolute top-2 left-2">
                  <span className="bg-green-500 text-white text-xs px-2 py-1 rounded">
                    Public
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <PhotoIcon className="h-12 w-12 mx-auto text-gray-400" />
          <p className="mt-2">No images uploaded yet</p>
          <p className="text-sm">Upload your first product image to get started</p>
        </div>
      )}

      {/* Usage Stats */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Total Images</p>
            <p className="font-medium">{images.length}</p>
          </div>
          <div>
            <p className="text-gray-500">Public Images</p>
            <p className="font-medium">{images.filter(img => img.isPublic).length}</p>
          </div>
          <div>
            <p className="text-gray-500">Total Size</p>
            <p className="font-medium">
              {(images.reduce((acc, img) => acc + img.size, 0) / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <div>
            <p className="text-gray-500">Available Slots</p>
            <p className="font-medium">{maxImages - images.length}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Usage example in a product form
export function ProductFormWithImages() {
  const [productImages, setProductImages] = useState<ProductImage[]>([])
  const productId = "your-product-id" // This would come from your product data

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Product Management</h1>
      
      {/* Other product form fields would go here */}
      
      <ProductImageManager
        productId={productId}
        maxImages={8}
        onImagesChange={(images) => {
          setProductImages(images)
          console.log('Product images updated:', images)
        }}
      />
      
      {/* Rest of the product form */}
    </div>
  )
}
