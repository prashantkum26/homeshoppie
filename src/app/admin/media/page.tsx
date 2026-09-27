'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface MediaImage {
  id: string
  serviceImageId: string
  filename: string
  originalName: string
  mimeType: string
  fileSize: string
  width: number | null
  height: number | null
  alt: string | null
  category: string | null
  createdAt: string
  productId: string | null
  product: {
    id: string
    name: string
  } | null
}

export default function MediaLibraryPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  
  const [images, setImages] = useState<MediaImage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Slide-over & Modal state
  const [selectedImage, setSelectedImage] = useState<MediaImage | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Upload State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('ALL')

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') router.push('/auth/signin')
    if (sessionStatus === 'authenticated') {
      if (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPER_ADMIN') {
        toast.error('Access denied.')
        router.push('/dashboard')
        return
      }
      fetchMedia()
    }
  }, [sessionStatus, router, session])

  const fetchMedia = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/admin/media')
      if (!response.ok) throw new Error('Failed to fetch media')
      setImages(await response.json())
    } catch (error) {
      toast.error('Could not load media library')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle standalone uploads
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile) return

    try {
      setIsUploading(true)
      const formData = new FormData()
      formData.append('file', uploadFile)

      const response = await fetch('/api/admin/media/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Upload failed')
      }

      toast.success('Image uploaded successfully')
      setUploadFile(null)
      setIsUploadModalOpen(false)
      await fetchMedia() // Refresh gallery
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedImage) return

    if (selectedImage.productId) {
      if (!confirm(`Warning: This image is attached to the product "${selectedImage.product?.name}". Deleting it will remove it from the product gallery. Continue?`)) {
        return
      }
    } else {
      if (!confirm('Are you sure you want to permanently delete this image?')) return
    }

    try {
      setIsDeleting(true)
      const queryParams = selectedImage.productId ? `?productId=${selectedImage.productId}` : ''
      
      const response = await fetch(`/api/admin/images/${selectedImage.serviceImageId}${queryParams}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete image')
      
      toast.success('Image deleted successfully')
      setSelectedImage(null)
      await fetchMedia()
    } catch (error) {
      toast.error('Failed to delete image')
    } finally {
      setIsDeleting(false)
    }
  }

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url)
    toast.success('URL copied to clipboard')
  }

  const formatBytes = (bytes: string) => {
    const num = parseInt(bytes)
    if (isNaN(num)) return bytes
    if (num < 1024) return num + ' B'
    if (num < 1048576) return (num / 1024).toFixed(1) + ' KB'
    return (num / 1048576).toFixed(2) + ' MB'
  }

  const filteredImages = images.filter(img => {
    const searchString = `${img.originalName} ${img.alt || ''} ${img.product?.name || ''}`.toLowerCase()
    const matchesSearch = searchString.includes(searchQuery.toLowerCase())
    const matchesCategory = filterCategory === 'ALL' || img.category === filterCategory
    return matchesSearch && matchesCategory
  })

  const uniqueCategories = Array.from(new Set(images.map(img => img.category).filter(Boolean))) as string[]

  if (sessionStatus === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="sm:flex sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Media Library</h1>
            <p className="mt-2 text-sm text-gray-700">Manage product images, banners, and standalone uploads.</p>
          </div>
          <div className="mt-4 sm:mt-0 flex gap-4 items-center">
            <Link href="/admin" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              &larr; Dashboard
            </Link>
            {/* Now fully functional! */}
            <button 
              onClick={() => setIsUploadModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 transition"
            >
              + Upload Media
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex flex-col sm:flex-row gap-4 border border-gray-200">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by filename, alt text, or product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
            />
          </div>
          <div className="sm:w-64">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
            >
              <option value="ALL">All Categories</option>
              <option value="upload">Standalone Uploads</option>
              {uniqueCategories.map(cat => (
                <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Image Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredImages.length === 0 ? (
            <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-lg border border-dashed">
              No media files found matching your search.
            </div>
          ) : (
            filteredImages.map((img) => (
              <div 
                key={img.id} 
                onClick={() => setSelectedImage(img)}
                className="group relative bg-white border border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:border-red-500 hover:shadow-md transition-all"
              >
                <div className="aspect-w-1 aspect-h-1 bg-gray-100 relative">
                  <img
                    src={`/api/admin/images/${img.serviceImageId}?size=thumbnail`}
                    alt={img.alt || img.originalName}
                    className="object-cover w-full h-40 group-hover:opacity-75 transition-opacity"
                    loading="lazy"
                  />
                  {img.productId && (
                    <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-[10px] px-2 py-1 rounded-full backdrop-blur-sm">
                      Linked
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-xs font-medium text-gray-900 truncate" title={img.originalName}>
                    {img.originalName}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1 uppercase">
                    {formatBytes(img.fileSize)} • {img.mimeType.split('/')[1]}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Upload Modal Overlay */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-500 bg-opacity-75">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Upload New Media</h3>
              <button onClick={() => { setIsUploadModalOpen(false); setUploadFile(null); }} className="text-gray-400 hover:text-gray-600">
                <span className="text-2xl">&times;</span>
              </button>
            </div>
            
            <form onSubmit={handleUploadSubmit} className="p-6 space-y-6">
              <div 
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-red-500 transition cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="hidden" 
                  accept="image/png, image/jpeg, image/webp"
                />
                
                {uploadFile ? (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-green-600">File Selected:</p>
                    <p className="text-sm text-gray-700 truncate">{uploadFile.name}</p>
                    <p className="text-xs text-gray-500">{formatBytes(uploadFile.size.toString())}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <span className="text-3xl">📤</span>
                    <p className="text-sm font-medium text-gray-900">Click to browse files</p>
                    <p className="text-xs text-gray-500">Supports JPG, PNG, WEBP</p>
                  </div>
                )}
              </div>

              <button 
                type="submit" 
                disabled={!uploadFile || isUploading}
                className="w-full bg-red-600 text-white font-bold py-2 rounded shadow hover:bg-red-700 disabled:opacity-50 transition"
              >
                {isUploading ? 'Uploading & Syncing...' : 'Upload Image'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Slide-over Detail Modal */}
      {selectedImage && (
        <div className="fixed inset-0 overflow-hidden z-40">
          <div className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setSelectedImage(null)} />
          <div className="fixed inset-y-0 right-0 pl-10 max-w-md w-full flex">
            <div className="w-full h-full flex flex-col bg-white shadow-xl">
              
              <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-900">File Details</h2>
                <button onClick={() => setSelectedImage(null)} className="text-gray-400 hover:text-gray-600">
                  <span className="text-2xl">&times;</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="bg-gray-100 border-b border-gray-200 flex justify-center items-center relative overflow-hidden min-h-[300px]">
                  <img
                    src={`/api/admin/images/${selectedImage.serviceImageId}?size=medium`}
                    alt={selectedImage.alt || 'Preview'}
                    className="max-w-full max-h-[400px] object-contain"
                  />
                </div>

                <div className="p-6 space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 border-b pb-2 mb-3">Metadata</h3>
                    <div className="space-y-3 text-sm">
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-gray-500">File Name:</span>
                        <span className="col-span-2 font-medium break-all">{selectedImage.originalName}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-gray-500">Uploaded:</span>
                        <span className="col-span-2 font-medium">{new Date(selectedImage.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-gray-500">Size:</span>
                        <span className="col-span-2 font-medium">{formatBytes(selectedImage.fileSize)}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-gray-500">Dimensions:</span>
                        <span className="col-span-2 font-medium">{selectedImage.width || '?'} x {selectedImage.height || '?'}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-gray-500">Service ID:</span>
                        <span className="col-span-2 font-mono text-xs bg-gray-100 p-1 rounded break-all">{selectedImage.serviceImageId}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 border-b pb-2 mb-3">Usage</h3>
                    {selectedImage.product ? (
                      <div className="bg-blue-50 border border-blue-100 rounded p-3 text-sm flex justify-between items-center">
                        <div>
                          <p className="text-blue-800 font-medium">Used in Product Gallery</p>
                          <p className="text-blue-600 text-xs mt-1">{selectedImage.product.name}</p>
                        </div>
                        <Link href={`/admin/products/${selectedImage.productId}/edit`} className="text-blue-700 underline text-xs font-bold">
                          Edit Product
                        </Link>
                      </div>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded p-3 text-sm text-gray-500">
                        This image is currently unattached (orphan/standalone).
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 border-b pb-2 mb-3">Actions</h3>
                    <div className="space-y-3">
                      <button 
                        onClick={() => copyToClipboard(`${window.location.origin}/api/public/images/${selectedImage.serviceImageId}`)}
                        className="w-full bg-white border border-gray-300 text-gray-700 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition"
                      >
                        Copy Public Image URL
                      </button>
                      
                      <button 
                        disabled={isDeleting}
                        onClick={handleDelete}
                        className="w-full bg-red-50 border border-red-200 text-red-700 py-2 rounded-md text-sm font-medium hover:bg-red-100 transition disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isDeleting ? 'Deleting...' : 'Permanently Delete Image'}
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}