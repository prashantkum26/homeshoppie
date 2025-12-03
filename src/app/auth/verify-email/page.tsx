'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { 
  EnvelopeIcon, 
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import Button from '@/components/ui/Button'
import toast from 'react-hot-toast'

export default function VerifyEmailPage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [errorMessage, setErrorMessage] = useState('')

  // Redirect if not logged in
  useEffect(() => {
    if (status === 'loading') return
    
    if (!session) {
      router.push('/auth/signin')
      return
    }

    // If email is already verified, redirect
    if (session.user.emailVerified) {
      router.push('/auth/verify')
      return
    }
  }, [session, status, router])

  // Auto-verify if token is present in URL
  useEffect(() => {
    if (token && !isVerifying && verificationStatus === 'pending') {
      handleVerifyToken(token)
    }
  }, [token, isVerifying, verificationStatus])

  const handleVerifyToken = async (verificationToken: string) => {
    setIsVerifying(true)
    try {
      const response = await fetch(`/api/auth/verify-email?token=${verificationToken}`, {
        method: 'GET'
      })

      const data = await response.json()

      if (response.ok) {
        setVerificationStatus('success')
        toast.success('Email verified successfully!')
        
        // Update session
        await update()
        
        // Redirect after success
        setTimeout(() => {
          router.push('/auth/verify')
        }, 2000)
      } else {
        setVerificationStatus('error')
        setErrorMessage(data.error || 'Verification failed')
        toast.error(data.error || 'Verification failed')
      }
    } catch (error) {
      setVerificationStatus('error')
      setErrorMessage('Something went wrong. Please try again.')
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResendVerification = async () => {
    if (!session?.user?.email) return
    
    setIsResending(true)
    try {
      const response = await fetch('/api/auth/send-email-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: session.user.email,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Verification email sent! Check your inbox.')
      } else {
        toast.error(data.error || 'Failed to send verification email')
      }
    } catch (error) {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsResending(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <ArrowPathIcon className="h-8 w-8 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
            {verificationStatus === 'success' ? (
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
            ) : verificationStatus === 'error' ? (
              <ExclamationCircleIcon className="h-6 w-6 text-red-600" />
            ) : (
              <EnvelopeIcon className="h-6 w-6 text-blue-600" />
            )}
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {verificationStatus === 'success' ? 'Email Verified!' :
             verificationStatus === 'error' ? 'Verification Failed' :
             'Verify Your Email'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {verificationStatus === 'success' ? 'Your email has been successfully verified' :
             verificationStatus === 'error' ? errorMessage :
             `We've sent a verification link to ${session.user.email}`}
          </p>
        </div>

        {/* Status Content */}
        {verificationStatus === 'pending' && !token && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <EnvelopeIcon className="h-5 w-5 text-blue-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    Check Your Email
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>
                      We've sent a verification link to your email address. 
                      Click the link in the email to verify your account.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center space-y-4">
              <Button
                onClick={handleResendVerification}
                disabled={isResending}
                variant="outline"
                className="w-full"
              >
                {isResending ? 'Sending...' : 'Resend Verification Email'}
              </Button>
              
              <p className="text-xs text-gray-500">
                Didn't receive the email? Check your spam folder or try resending.
              </p>
            </div>
          </div>
        )}

        {verificationStatus === 'success' && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <CheckCircleIcon className="h-5 w-5 text-green-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">
                    Email Verified Successfully
                  </h3>
                  <div className="mt-2 text-sm text-green-700">
                    <p>Your email address has been verified. You can now access all features.</p>
                  </div>
                </div>
              </div>
            </div>

            <Button
              onClick={() => router.push('/auth/verify')}
              className="w-full"
            >
              Continue to Verification Status
            </Button>
          </div>
        )}

        {verificationStatus === 'error' && (
          <div className="space-y-6">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <ExclamationCircleIcon className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Verification Failed
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{errorMessage}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Button
                onClick={handleResendVerification}
                disabled={isResending}
                className="w-full"
              >
                {isResending ? 'Sending...' : 'Send New Verification Email'}
              </Button>
              
              <Link href="/auth/verify">
                <Button variant="outline" className="w-full">
                  Back to Verification
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Loading State for Token Verification */}
        {isVerifying && (
          <div className="text-center">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-primary-600 mx-auto mb-4" />
            <p className="text-gray-600">Verifying your email...</p>
          </div>
        )}

        {/* Help Links */}
        <div className="text-center space-y-2">
          <Link
            href="/auth/verify"
            className="text-sm text-primary-600 hover:text-primary-500"
          >
            Back to Verification Status
          </Link>
          
          <div>
            <Link
              href="/contact"
              className="text-sm text-gray-600 hover:text-gray-500"
            >
              Need help? Contact support
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
