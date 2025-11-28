'use client'

import { useState } from 'react'
import { imageService } from '../../lib/homeshoppieImageService'

export default function TestImageServicePage() {
  const [status, setStatus] = useState<string>('Ready to test')
  const [authResult, setAuthResult] = useState<any>(null)
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testAuthentication = async () => {
    setLoading(true)
    setStatus('Testing authentication...')
    
    try {
      const result = await imageService.authenticate()
      setAuthResult({ success: result, message: result ? 'Authentication successful!' : 'Authentication failed' })
      setStatus(result ? 'Authentication successful!' : 'Authentication failed')
    } catch (error) {
      setAuthResult({ success: false, error: error instanceof Error ? error.message : String(error) })
      setStatus(`Authentication error: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setLoading(false)
    }
  }

  const testImageUpload = async () => {
    if (!authResult?.success) {
      setStatus('Please authenticate first')
      return
    }

    setLoading(true)
    setStatus('Testing image upload via API endpoint...')
    
    try {
      // Create a test image file (1x1 pixel PNG)
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setStatus('Failed to get canvas context')
        setLoading(false)
        return
      }
      ctx.fillStyle = '#FF0000'
      ctx.fillRect(0, 0, 1, 1)
      
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setStatus('Failed to create test image')
          setLoading(false)
          return
        }

        const formData = new FormData()
        formData.append('image', blob, 'test-image.png')
        formData.append('productId', 'test-product-123')
        formData.append('category', 'product')
        formData.append('entityType', 'product')
        formData.append('alt', 'Test product image')
        formData.append('title', 'Test Image')
        formData.append('tags', JSON.stringify(['test', 'homeshoppie']))

        try {
          const response = await fetch('/api/images/upload', {
            method: 'POST',
            body: formData
          })

          const result = await response.json()
          setUploadResult(result)
          
          if (result.success) {
            setStatus(`Upload successful! Image ID: ${result.data.imageId}`)
          } else {
            setStatus(`Upload failed: ${result.error}`)
          }
        } catch (error) {
          setUploadResult({ success: false, error: error instanceof Error ? error.message : String(error) })
          setStatus(`Upload error: ${error instanceof Error ? error.message : String(error)}`)
        } finally {
          setLoading(false)
        }
      }, 'image/png')
    } catch (error) {
      setUploadResult({ success: false, error: error instanceof Error ? error.message : String(error) })
      setStatus(`Upload error: ${error instanceof Error ? error.message : String(error)}`)
      setLoading(false)
    }
  }

  const testPublicAccess = async () => {
    if (!uploadResult?.success) {
      setStatus('Please upload an image first')
      return
    }

    setLoading(true)
    setStatus('Testing public image access...')
    
    try {
      const imageId = uploadResult.data.imageId
      const response = await fetch(`/api/public/images/${imageId}?size=thumbnail`)
      
      if (response.ok) {
        setStatus('Public access successful!')
      } else {
        const errorData = await response.json()
        setStatus(`Public access failed: ${errorData.error}`)
      }
    } catch (error) {
      setStatus(`Public access error: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setLoading(false)
    }
  }

  const testAdminAccess = async () => {
    if (!uploadResult?.success) {
      setStatus('Please upload an image first')
      return
    }

    setLoading(true)
    setStatus('Testing admin image access...')
    
    try {
      const imageId = uploadResult.data.imageId
      const response = await fetch(`/api/admin/images/${imageId}?size=thumbnail`)
      
      if (response.ok) {
        setStatus('Admin access successful!')
      } else {
        const errorData = await response.json()
        setStatus(`Admin access failed: ${errorData.error}`)
      }
    } catch (error) {
      setStatus(`Admin access error: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">HomeShoppe Image Service Test</h1>
      
      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-2">Status:</h2>
        <p className={`font-mono text-sm ${loading ? 'text-blue-600' : 'text-gray-800'}`}>
          {loading && '⏳ '}{status}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <button
          onClick={testAuthentication}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          1. Test Authentication
        </button>
        
        <button
          onClick={testImageUpload}
          disabled={loading || !authResult?.success}
          className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          2. Test Image Upload
        </button>
        
        <button
          onClick={testPublicAccess}
          disabled={loading || !uploadResult?.success}
          className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          3. Test Public Access
        </button>
        
        <button
          onClick={testAdminAccess}
          disabled={loading || !uploadResult?.success}
          className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          4. Test Admin Access
        </button>
      </div>

      <div className="space-y-4">
        {authResult && (
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="font-semibold mb-2">Authentication Result:</h3>
            <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto">
              {JSON.stringify(authResult, null, 2)}
            </pre>
          </div>
        )}
        
        {uploadResult && (
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="font-semibold mb-2">Upload Result:</h3>
            <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto">
              {JSON.stringify(uploadResult, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold text-yellow-800 mb-2">Environment Configuration:</h3>
        <div className="text-sm text-yellow-700 space-y-1">
          <p><strong>API Key:</strong> ak_ac79cbe81f7e7cd45887a5c44b4b7082</p>
          <p><strong>Base URL:</strong> http://localhost:5000</p>
          <p><strong>Service Status:</strong> {loading ? 'Testing...' : 'Ready'}</p>
        </div>
      </div>
    </div>
  )
}
