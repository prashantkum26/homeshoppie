'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  DevicePhoneMobileIcon, 
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import Button from '@/components/ui/Button'
import toast from 'react-hot-toast'

export default function VerifyPhonePage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const [isVerifying, setIsVerifying] = useState(false)
  const [otp, setOtp] = useState('')

  // Redirect if not logged in or no phone number
  useEffect(() => {
    if (status === 'loading') return
    
    if (!session) {
      router.push('/auth/signin')
      return
    }

    if (!session.user.phone) {
      router.push('/auth/verify')
      return
    }

    // If phone is already verified, redirect
    if (session.user.phoneVerified) {
      router.push('/auth/verify')
      return
    }
  }, [session, status, router])

  const handleSendOTP = async () => {
    if (!session?.user?.phone) return
    
    setIsVerifying(true)
    try {
      // TODO: Implement SMS OTP sending
      toast.success('OTP sent to your phone (SMS service not yet integrated)')
    } catch (error) {
      toast.error('Failed to send OTP. Please try again.')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP')
      return
    }

    setIsVerifying(true)
    try {
      // TODO: Implement OTP verification
      toast.success('Phone verified successfully!')
      await update()
      router.push('/auth/verify')
    } catch (error) {
      toast.error('Invalid OTP. Please try again.')
    } finally {
      setIsVerifying(false)
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

  if (!session || !session.user.phone) return null

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
            <DevicePhoneMobileIcon className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Verify Your Phone Number
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            We'll send a verification code to {session.user.phone}
          </p>
        </div>

        {/* Phone Verification Content */}
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <DevicePhoneMobileIcon className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  SMS Verification (Coming Soon)
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    Phone verification via SMS is currently being integrated. 
                    For now, you can skip this step or contact support.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* OTP Input */}
          <div className="space-y-4">
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
                Enter 6-digit OTP
              </label>
              <input
                id="otp"
                name="otp"
                type="text"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-center text-lg tracking-widest"
                disabled={true} // Disabled until SMS integration
              />
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleSendOTP}
                disabled={isVerifying}
                variant="outline"
                className="w-full"
              >
                {isVerifying ? 'Sending...' : 'Send OTP'}
              </Button>
              
              <Button
                onClick={handleVerifyOTP}
                disabled={!otp || otp.length !== 6 || isVerifying}
                className="w-full opacity-50 cursor-not-allowed"
              >
                Verify OTP (Coming Soon)
              </Button>
            </div>
          </div>

          {/* Skip Option */}
          <div className="text-center">
            <Link
              href="/auth/verify"
              className="text-sm text-primary-600 hover:text-primary-500"
            >
              Skip phone verification for now
            </Link>
          </div>

          {/* Help Text */}
          <div className="text-center">
            <p className="text-xs text-gray-500">
              Having trouble? Contact our support team for assistance.
            </p>
          </div>
        </div>

        {/* Back Link */}
        <div className="text-center">
          <Link
            href="/auth/verify"
            className="text-sm text-gray-600 hover:text-gray-500"
          >
            ← Back to Verification Status
          </Link>
        </div>
      </div>
    </div>
  )
}
