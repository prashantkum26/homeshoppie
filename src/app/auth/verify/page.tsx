'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  EnvelopeIcon, 
  DevicePhoneMobileIcon, 
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import Button from '@/components/ui/Button'
import toast from 'react-hot-toast'

export default function VerifyPage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const [isResending, setIsResending] = useState(false)

  // Redirect if not logged in
  useEffect(() => {
    if (status === 'loading') return
    
    if (!session) {
      router.push('/auth/signin')
      return
    }

    // If both email and phone are verified, redirect to dashboard
    if (session.user.emailVerified && (!session.user.phone || session.user.phoneVerified)) {
      router.push('/dashboard')
      return
    }
  }, [session, status, router])

  const handleResendEmail = async () => {
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

  const refreshSession = async () => {
    await update()
    // Force a page reload to get fresh session data
    window.location.reload()
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

  const emailVerified = session.user.emailVerified
  const phoneVerified = !session.user.phone || session.user.phoneVerified
  const allVerified = emailVerified && phoneVerified

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
            <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Account Verification Required
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Please verify your account to continue using HomeShoppie
          </p>
        </div>

        {/* Verification Status Cards */}
        <div className="space-y-4">
          {/* Email Verification */}
          <div className={`border rounded-lg p-4 ${
            emailVerified 
              ? 'bg-green-50 border-green-200' 
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                {emailVerified ? (
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                ) : (
                  <EnvelopeIcon className="h-6 w-6 text-yellow-600" />
                )}
              </div>
              <div className="ml-3 flex-1">
                <h3 className={`text-sm font-medium ${
                  emailVerified ? 'text-green-800' : 'text-yellow-800'
                }`}>
                  Email Verification
                </h3>
                <p className={`text-xs ${
                  emailVerified ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {emailVerified 
                    ? 'Your email has been verified' 
                    : `Verify ${session.user.email}`
                  }
                </p>
              </div>
              {!emailVerified && (
                <div className="flex space-x-2">
                  <Button
                    onClick={handleResendEmail}
                    disabled={isResending}
                    variant="outline"
                    size="sm"
                  >
                    {isResending ? 'Sending...' : 'Resend'}
                  </Button>
                  <Link href="/auth/verify-email">
                    <Button size="sm">
                      Verify
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Phone Verification */}
          {session.user.phone && (
            <div className={`border rounded-lg p-4 ${
              phoneVerified 
                ? 'bg-green-50 border-green-200' 
                : 'bg-yellow-50 border-yellow-200'
            }`}>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  {phoneVerified ? (
                    <CheckCircleIcon className="h-6 w-6 text-green-600" />
                  ) : (
                    <DevicePhoneMobileIcon className="h-6 w-6 text-yellow-600" />
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <h3 className={`text-sm font-medium ${
                    phoneVerified ? 'text-green-800' : 'text-yellow-800'
                  }`}>
                    Phone Verification
                  </h3>
                  <p className={`text-xs ${
                    phoneVerified ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    {phoneVerified 
                      ? 'Your phone number has been verified' 
                      : `Verify ${session.user.phone}`
                    }
                  </p>
                </div>
                {!phoneVerified && (
                  <Link href="/auth/verify-phone">
                    <Button size="sm">
                      Verify
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-4">
          {allVerified && (
            <Button
              onClick={() => router.push('/dashboard')}
              className="w-full"
            >
              Continue to Dashboard
            </Button>
          )}
          
          <div className="flex justify-center">
            <button
              onClick={refreshSession}
              className="text-sm text-primary-600 hover:text-primary-500"
            >
              Refresh verification status
            </button>
          </div>

          <div className="text-center">
            <Link
              href="/auth/signin"
              className="text-sm text-gray-600 hover:text-gray-500"
            >
              Sign out and use different account
            </Link>
          </div>
        </div>

        {/* Help Text */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            Having trouble? Contact our support team for assistance.
          </p>
        </div>
      </div>
    </div>
  )
}
