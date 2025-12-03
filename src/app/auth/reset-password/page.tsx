'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { EyeIcon, EyeSlashIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface FormData {
  password: string
  confirmPassword: string
}

interface PasswordRequirement {
  regex: RegExp
  text: string
  met: boolean
}

export default function ResetPasswordPage() {
  const [formData, setFormData] = useState<FormData>({
    password: '',
    confirmPassword: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [tokenValid, setTokenValid] = useState<boolean | null>(null)
  
  const router = useRouter()
  const searchParams = useSearchParams()

  // Password requirements
  const [passwordRequirements, setPasswordRequirements] = useState<PasswordRequirement[]>([
    { regex: /.{8,}/, text: 'At least 8 characters', met: false },
    { regex: /[A-Z]/, text: 'One uppercase letter', met: false },
    { regex: /[a-z]/, text: 'One lowercase letter', met: false },
    { regex: /\d/, text: 'One number', met: false },
    { regex: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?]/, text: 'One special character', met: false }
  ])

  useEffect(() => {
    const tokenParam = searchParams.get('token')
    if (tokenParam) {
      setToken(tokenParam)
      verifyToken(tokenParam)
    } else {
      setTokenValid(false)
    }
  }, [searchParams])

  const verifyToken = async (tokenToVerify: string) => {
    try {
      const response = await fetch('/api/auth/verify-reset-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenToVerify })
      })
      
      const data = await response.json()
      setTokenValid(data.valid)
      
      if (!data.valid) {
        toast.error(data.message || 'Invalid or expired reset token')
      }
    } catch (error) {
      console.error('Token verification error:', error)
      setTokenValid(false)
      toast.error('Failed to verify reset token')
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))

    // Update password requirements
    if (name === 'password') {
      setPasswordRequirements(prev =>
        prev.map(req => ({
          ...req,
          met: req.regex.test(value)
        }))
      )
    }
  }

  const validatePasswords = (): boolean => {
    if (!formData.password) {
      toast.error('Password is required')
      return false
    }

    if (!passwordRequirements.every(req => req.met)) {
      toast.error('Please meet all password requirements')
      return false
    }

    if (!formData.confirmPassword) {
      toast.error('Please confirm your password')
      return false
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match')
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (!validatePasswords() || !token) {
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: formData.password
        })
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.message || 'Failed to reset password')
        return
      }

      toast.success('Password reset successfully!')
      
      // Redirect to sign in page
      setTimeout(() => {
        router.push('/auth/signin?message=password-reset-success')
      }, 2000)

    } catch (error) {
      console.error('Reset password error:', error)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Loading state
  if (tokenValid === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying reset token...</p>
        </div>
      </div>
    )
  }

  // Invalid token
  if (tokenValid === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <XCircleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Invalid Reset Link</h2>
          <p className="text-gray-600 mb-6">
            This password reset link is invalid or has expired. Reset links are valid for 1 hour after being sent.
          </p>
          <div className="space-y-3">
            <Link
              href="/auth/forgot-password"
              className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors inline-block"
            >
              Request New Reset Link
            </Link>
            <Link
              href="/auth/signin"
              className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors inline-block"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const allRequirementsMet = passwordRequirements.every(req => req.met)
  const passwordsMatch = formData.password && formData.confirmPassword && formData.password === formData.confirmPassword

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            Reset Your Password
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your new password below
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* New Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                New Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 text-gray-900 pr-10"
                  placeholder="Enter your new password"
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
              
              {/* Password Requirements */}
              {formData.password && (
                <div className="mt-3 p-4 bg-gray-50 rounded-md">
                  <p className="text-sm font-medium text-gray-700 mb-2">Password requirements:</p>
                  <div className="space-y-1">
                    {passwordRequirements.map((req, index) => (
                      <div key={index} className="flex items-center text-sm">
                        {req.met ? (
                          <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                        ) : (
                          <XCircleIcon className="h-4 w-4 text-gray-400 mr-2" />
                        )}
                        <span className={req.met ? 'text-green-700' : 'text-gray-600'}>
                          {req.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm New Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 text-gray-900 pr-10"
                  placeholder="Confirm your new password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              
              {/* Password Match Indicator */}
              {formData.confirmPassword && (
                <div className="mt-2 flex items-center text-sm">
                  {passwordsMatch ? (
                    <>
                      <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                      <span className="text-green-700">Passwords match</span>
                    </>
                  ) : (
                    <>
                      <XCircleIcon className="h-4 w-4 text-red-500 mr-2" />
                      <span className="text-red-600">Passwords do not match</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading || !allRequirementsMet || !passwordsMatch}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : null}
                {isLoading ? 'Resetting Password...' : 'Reset Password'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            <Link href="/auth/signin" className="font-medium text-green-600 hover:text-green-500">
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
