'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Image from 'next/image'
import { PhotoIcon, XMarkIcon, ArrowUpTrayIcon, TrashIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface ImageUploaderProps {
  productId?: string
  existingImages?: string[]
  onImagesChange?: (images: string[]) => void
  maxImages?: number
  category?: string
}

interface UploadedImage {
  id: string
  url: string
  accessToken: string
  thumbnailUrl: string
  originalName: string
}

export default function ImageUploader({
  productId,
  existingImages = [],
  onImagesChange,
  maxImages = 10,
  category = 'product'
}: ImageUploaderProps) {
  const [images, setImages] = useState<UploadedImage[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Initialize with existing images
  useEffect(() => {
    if (existingImages.length > 0) {
      const mappedImages = existingImages.map((url, index) => {
        // Extract image ID from URL for proper thumbnail generation
        const imageId = url.includes('/api/public/images/') 
          ? url.replace('/api/public/images/', '').split('?')[0]
          : `existing-${index}`
        
        return {
          id: imageId,
          url,
          accessToken: '',
          thumbnailUrl: url.includes('/api/public/images/') 
            ? `${url}?size=thumbnail`
            : url,
          originalName: `Image ${index + 1}`
        }
      })
      setImages(mappedImages)
    } else {
      setImages([]) // Clear images if no existing images
    }
  }, [existingImages])

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    
    // Validate file types
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

    // Check if adding these files would exceed the limit
    if (images.length + validFiles.length > maxImages) {
      toast.error(`Cannot upload more than ${maxImages} images`)
      return
    }

    setUploading(true)

    try {
      const uploadPromises = validFiles.map(async (file) => {
        try {
          // Create FormData for upload
          const formData = new FormData()
          formData.append('image', file)
          formData.append('entityType', 'product')
          formData.append('category', category)
          formData.append('alt', `Product image - ${file.name}`)
          formData.append('title', file.name)
          
          if (productId) {
            formData.append('productId', productId)
          }

          // Upload via homeshoppie proxy endpoint
          const response = await fetch('/api/images/upload', {
            method: 'POST',
            body: formData
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Upload failed')
          }

          const result = await response.json()

          return {
            id: result.data.imageId,
            url: `/api/public/images/${result.data.imageId}`,
            accessToken: result.data.accessToken || '',
            thumbnailUrl: `/api/public/images/${result.data.imageId}?size=thumbnail`,
            originalName: result.data.originalName
          }
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error)
          toast.error(`Failed to upload ${file.name}`)
          return null
        }
      })

      const uploadedImages = (await Promise.all(uploadPromises)).filter(Boolean) as UploadedImage[]
      
      if (uploadedImages.length > 0) {
        const newImages = [...images, ...uploadedImages]
        setImages(newImages)
        
        // Notify parent component
        if (onImagesChange) {
          onImagesChange(newImages.map(img => img.url))
        }
        
        toast.success(`Successfully uploaded ${uploadedImages.length} image${uploadedImages.length > 1 ? 's' : ''}`)
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to upload images')
    } finally {
      setUploading(false)
    }
  }, [images, maxImages, productId, category, onImagesChange])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files)
    }
  }, [handleFiles])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files)
    }
  }, [handleFiles])

  const removeImage = useCallback(async (imageId: string, index: number) => {
    try {
      // If it's an image from the image service (has a UUID format), delete it
      if (imageId.includes('-') && imageId.length > 10) {
        // Include productId as query parameter for proper cleanup
        const deleteUrl = productId 
          ? `/api/admin/images/${imageId}?productId=${productId}`
          : `/api/admin/images/${imageId}`
        
        const response = await fetch(deleteUrl, {
          method: 'DELETE'
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to delete image')
        }

        const result = await response.json()
        
        // Log the database update status
        if (result.databaseUpdated) {
          console.log('✅ Product database updated successfully')
        }
      }
      
      const newImages = images.filter((_, i) => i !== index)
      setImages(newImages)
      
      // Notify parent component
      if (onImagesChange) {
        onImagesChange(newImages.map(img => img.url))
      }
      
      toast.success('Image removed successfully')
    } catch (error) {
      console.error('Failed to remove image:', error)
      toast.error('Failed to remove image')
    }
  }, [images, onImagesChange, productId])

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
          dragActive 
            ? 'border-red-400 bg-red-50' 
            : 'border-gray-300 hover:border-gray-400'
        } ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />
        
        <div className="text-center">
          <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
          <div className="mt-4">
            <p className="text-sm text-gray-600">
              {uploading ? 'Uploading...' : 'Drag and drop images here, or click to browse'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              PNG, JPG, WebP up to 5MB each (max {maxImages} images)
            </p>
          </div>
          
          {uploading && (
            <div className="mt-4">
              <div className="inline-flex items-center px-4 py-2 bg-red-100 text-red-800 rounded-md">
                <ArrowUpTrayIcon className="animate-pulse h-4 w-4 mr-2" />
                Uploading images...
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Images Grid */}
      {images.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Uploaded Images ({images.length}/{maxImages})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {images.map((image, index) => (
              <div key={`${image.id}-${index}`} className="relative group">
                <div className="aspect-square bg-gray-200 rounded-lg overflow-hidden">
                  <Image
                    src={image.thumbnailUrl || image.url}
                    alt={image.originalName}
                    width={200}
                    height={200}
                    className="w-full h-full object-cover"
                    onError={() => {
                      console.error('Failed to load image:', image.url)
                    }}
                  />
                </div>
                
                {/* Remove Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeImage(image.id, index)
                  }}
                  className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                  title="Remove image"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
                
                {/* Image Info */}
                <div className="mt-2">
                  <p className="text-xs text-gray-500 truncate" title={image.originalName}>
                    {image.originalName}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Limit Info */}
      {images.length >= maxImages && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <p className="text-sm text-yellow-800">
            Maximum number of images reached ({maxImages}). Remove some images to upload more.
          </p>
        </div>
      )}
    </div>
  )
}
