'use client'

import { useState, useEffect } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import useWishlistStore from '@/store/wishlistStore'

interface FormData {
  email: string
  password: string
}

export default function SignInPage() {
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [redirectUrl, setRedirectUrl] = useState<string>('/')
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Enhanced redirect URL handling with validation
    const callbackUrl = searchParams.get('callbackUrl') || 
                       searchParams.get('redirect') || 
                       searchParams.get('returnTo') || 
                       searchParams.get('next') || '/'
    
    // Decode and validate the redirect URL
    let decodedUrl = decodeURIComponent(callbackUrl)
    
    // Security check: ensure redirect URL is safe (same origin or relative)
    if (decodedUrl.startsWith('http://') || decodedUrl.startsWith('https://')) {
      try {
        const url = new URL(decodedUrl)
        const currentOrigin = window.location.origin
        
        // Only allow redirects to same origin
        if (url.origin !== currentOrigin) {
          console.warn('External redirect blocked for security:', decodedUrl)
          decodedUrl = '/' // Fallback to home
        }
      } catch (error) {
        console.warn('Invalid redirect URL:', decodedUrl)
        decodedUrl = '/' // Fallback to home
      }
    }
    
    // Ensure URL starts with / for relative paths
    if (!decodedUrl.startsWith('/') && !decodedUrl.startsWith('http')) {
      decodedUrl = '/' + decodedUrl
    }
    
    setRedirectUrl(decodedUrl)
  }, [searchParams])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false
      })

      if (result?.error) {
        toast.error('Invalid email or password')
      } else {
        toast.success('Signed in successfully!')
        
        // Get the updated session to check user role
        const session = await getSession()
        
        // Sync wishlist after successful login
        try {
          await useWishlistStore.getState().fetchFromServer()
          console.log('Wishlist synced after login')
        } catch (syncError) {
          console.error('Failed to sync wishlist after login:', syncError)
        }
        
        // Redirect based on user role or return URL
        if (session?.user?.role === 'ADMIN') {
          router.push('/admin')
        } else {
          router.push(redirectUrl)
        }
      }
    } catch (error) {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Or{' '}
            <Link
              href="/auth/signup"
              className="font-medium text-primary-600 hover:text-primary-500"
            >
              create a new account
            </Link>
          </p>
          {redirectUrl !== '/' && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <span className="font-medium">After signing in, you'll be redirected to:</span>
                <br />
                <span className="text-xs text-blue-600 break-all">{redirectUrl}</span>
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 text-gray-900"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 text-gray-900 pr-10"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <Link
                  href="/auth/forgot-password"
                  className="font-medium text-primary-600 hover:text-primary-500"
                >
                  Forgot your password?
                </Link>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : null}
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>

          {/* Demo accounts */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Demo Accounts</span>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Customer:</strong> customer@homeshoppie.com / password123
                </p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Admin:</strong> admin@homeshoppie.com / admin123
                </p>
              </div>
            </div>
          </div>

          {/* Trust signals */}
          <div className="mt-6 text-center">
            <div className="text-xs text-gray-500 space-y-1">
              <p>🔒 Secure login with encryption</p>
              <p>🛡️ Your data is protected</p>
            </div>
          </div>
        </div>

        {/* Additional links */}
        <div className="mt-6 text-center text-sm">
          <p className="text-gray-600">
            New to HomeShoppie?{' '}
            <Link
              href="/auth/signup"
              className="font-medium text-primary-600 hover:text-primary-500"
            >
              Create your account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
