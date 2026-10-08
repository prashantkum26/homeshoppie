'use client'

import {
  useCallback,
  useState,
} from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import toast from 'react-hot-toast'

import PhoneInput from '@/components/PhoneInput'
import type {
  PhoneValidationResult,
} from '@/lib/phoneValidation'

interface FormData {
  name: string
  email: string
  phone: string
  countryCode: string
  password: string
  confirmPassword: string
}

const INITIAL_FORM_DATA: FormData = {
  name: '',
  email: '',
  phone: '',
  countryCode: 'IN',
  password: '',
  confirmPassword: '',
}

export default function SignupPage() {
  const router = useRouter()

  const [formData, setFormData] =
    useState<FormData>(INITIAL_FORM_DATA)

  const [phoneValidation, setPhoneValidation] =
    useState<PhoneValidationResult>({
      isValid: true,
    })

  const [isLoading, setIsLoading] =
    useState(false)

  const [showPassword, setShowPassword] =
    useState(false)

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false)

  // ============================================================
  // INPUT CHANGE
  // ============================================================

  const handleChange = useCallback(
    (
      event: React.ChangeEvent<HTMLInputElement>
    ) => {
      const {
        name,
        value,
      } = event.target

      setFormData((previous) => ({
        ...previous,
        [name]: value,
      }))
    },
    []
  )

  // ============================================================
  // PHONE CHANGE
  // ============================================================

  const handlePhoneChange = useCallback(
    (
      phone: string,
      validation: PhoneValidationResult
    ) => {
      setFormData((previous) => ({
        ...previous,
        phone,
      }))

      setPhoneValidation(validation)
    },
    []
  )

  // ============================================================
  // COUNTRY CHANGE
  // ============================================================

  const handleCountryChange =
    useCallback(
      (countryCode: string) => {
        setFormData((previous) => ({
          ...previous,
          countryCode,
        }))
      },
      []
    )

  // ============================================================
  // SUBMIT
  // ============================================================

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    if (isLoading) {
      return
    }

    const name =
      formData.name.trim()

    const email =
      formData.email.trim().toLowerCase()

    const phone =
      formData.phone.trim()

    // ----------------------------------------------------------
    // VALIDATION
    // ----------------------------------------------------------

    if (!name) {
      toast.error(
        'Please enter your full name'
      )
      return
    }

    if (!email) {
      toast.error(
        'Please enter your email address'
      )
      return
    }

    if (!formData.password) {
      toast.error(
        'Please enter your password'
      )
      return
    }

    if (
      formData.password.length < 6
    ) {
      toast.error(
        'Password must be at least 6 characters'
      )
      return
    }

    if (
      formData.password !==
      formData.confirmPassword
    ) {
      toast.error(
        'Passwords do not match'
      )
      return
    }

    if (
      phone &&
      !phoneValidation.isValid
    ) {
      toast.error(
        phoneValidation.error ||
          'Please enter a valid phone number'
      )
      return
    }

    setIsLoading(true)

    try {
      // --------------------------------------------------------
      // CREATE ACCOUNT
      // --------------------------------------------------------

      const response = await fetch(
        '/api/auth/signup',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            name,
            email,
            phone:
              phoneValidation.e164Format ||
              phone ||
              '',
            countryCode:
              formData.countryCode,
            password:
              formData.password,
          }),
        }
      )

      let data: {
        error?: string
      } = {}

      try {
        data =
          await response.json()
      } catch {
        // Ignore invalid JSON.
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Unable to create your account'
        )
      }

      toast.success(
        'Account created successfully!'
      )

      // --------------------------------------------------------
      // AUTO LOGIN
      // --------------------------------------------------------

      const result =
        await signIn(
          'credentials',
          {
            email,
            password:
              formData.password,
            redirect: false,
          }
        )

      if (result?.ok) {
        router.push('/dashboard')
        router.refresh()
        return
      }

      toast.success(
        'Please sign in to continue'
      )

      router.push(
        '/auth/signin'
      )
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to create account'

      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const passwordsMatch =
    formData.confirmPassword.length > 0 &&
    formData.password ===
      formData.confirmPassword

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-[420px]">

        {/* ==================================================== */}
        {/* BRAND */}
        {/* ==================================================== */}

        <div className="mb-7 text-center">
          {/* <Link
            href="/"
            className="inline-flex items-center"
          >
            <span className="text-2xl font-extrabold tracking-tight text-gray-900">
              Home
              <span className="text-green-600">
                Shoppie
              </span>
            </span>
          </Link> */}

          <h1 className="mt-6 text-2xl font-bold tracking-tight text-gray-900">
            Create your account
          </h1>

          <p className="mt-1.5 text-sm text-gray-500">
            Join HomeShoppie and start shopping today.
          </p>
        </div>

        {/* ==================================================== */}
        {/* CARD */}
        {/* ==================================================== */}

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] sm:p-6">

          <form
            onSubmit={handleSubmit}
            noValidate
            className="space-y-4"
          >

            {/* ================================================ */}
            {/* FULL NAME */}
            {/* ================================================ */}

            <div>
              <label
                htmlFor="name"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Full Name
                <span className="ml-1 text-red-500">
                  *
                </span>
              </label>

              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={formData.name}
                onChange={handleChange}
                disabled={isLoading}
                placeholder="Enter your full name"
                className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 hover:border-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/10 disabled:cursor-not-allowed disabled:bg-gray-50"
              />
            </div>

            {/* ================================================ */}
            {/* EMAIL */}
            {/* ================================================ */}

            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Email Address
                <span className="ml-1 text-red-500">
                  *
                </span>
              </label>

              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                disabled={isLoading}
                placeholder="Enter your email address"
                className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 hover:border-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/10 disabled:cursor-not-allowed disabled:bg-gray-50"
              />
            </div>

            {/* ================================================ */}
            {/* PHONE */}
            {/* ================================================ */}

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="phone"
                  className="text-sm font-medium text-gray-700"
                >
                  Phone Number
                </label>

                <span className="text-xs text-gray-400">
                  Optional
                </span>
              </div>

              <PhoneInput
                id="phone"
                value={formData.phone}
                onChange={
                  handlePhoneChange
                }
                countryCode={
                  formData.countryCode
                }
                onCountryChange={
                  handleCountryChange
                }
                placeholder="Enter your phone number"
                disabled={isLoading}
              />
            </div>

            {/* ================================================ */}
            {/* PASSWORD */}
            {/* ================================================ */}

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Password
                <span className="ml-1 text-red-500">
                  *
                </span>
              </label>

              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={
                    formData.password
                  }
                  onChange={
                    handleChange
                  }
                  disabled={isLoading}
                  placeholder="Create a password"
                  className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3.5 pr-16 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 hover:border-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/10 disabled:cursor-not-allowed disabled:bg-gray-50"
                />

                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() =>
                    setShowPassword(
                      (previous) =>
                        !previous
                    )
                  }
                  className="absolute inset-y-0 right-0 flex w-14 items-center justify-center text-xs font-medium text-gray-500 hover:text-gray-700"
                >
                  {showPassword
                    ? 'Hide'
                    : 'Show'}
                </button>
              </div>

              <p className="mt-1 text-xs text-gray-400">
                Minimum 6 characters
              </p>
            </div>

            {/* ================================================ */}
            {/* CONFIRM PASSWORD */}
            {/* ================================================ */}

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Confirm Password
                <span className="ml-1 text-red-500">
                  *
                </span>
              </label>

              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={
                    showConfirmPassword
                      ? 'text'
                      : 'password'
                  }
                  autoComplete="new-password"
                  required
                  value={
                    formData.confirmPassword
                  }
                  onChange={
                    handleChange
                  }
                  disabled={isLoading}
                  placeholder="Confirm your password"
                  className={`h-11 w-full rounded-lg border bg-white px-3.5 pr-16 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 hover:border-gray-400 focus:ring-2 disabled:cursor-not-allowed disabled:bg-gray-50 ${
                    passwordsMatch
                      ? 'border-green-400 focus:border-green-500 focus:ring-green-500/10'
                      : 'border-gray-300 focus:border-green-500 focus:ring-green-500/10'
                  }`}
                />

                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() =>
                    setShowConfirmPassword(
                      (previous) =>
                        !previous
                    )
                  }
                  className="absolute inset-y-0 right-0 flex w-14 items-center justify-center text-xs font-medium text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword
                    ? 'Hide'
                    : 'Show'}
                </button>
              </div>

              {passwordsMatch && (
                <p className="mt-1 text-xs text-green-600">
                  ✓ Passwords match
                </p>
              )}
            </div>

            {/* ================================================ */}
            {/* SUBMIT */}
            {/* ================================================ */}

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 flex h-11 w-full items-center justify-center rounded-lg bg-green-600 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 active:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <svg
                    className="mr-2 h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      className="opacity-25"
                    />

                    <path
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z"
                      className="opacity-75"
                    />
                  </svg>

                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </button>

            {/* ================================================ */}
            {/* TERMS */}
            {/* ================================================ */}

            <p className="pt-1 text-center text-[11px] leading-5 text-gray-400">
              By creating an account, you agree to our{' '}
              <Link
                href="/terms"
                className="font-medium text-gray-600 hover:text-green-600"
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                href="/privacy"
                className="font-medium text-gray-600 hover:text-green-600"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </form>
        </div>

        {/* ==================================================== */}
        {/* SIGN IN */}
        {/* ==================================================== */}

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link
            href="/auth/signin"
            className="font-semibold text-green-600 hover:text-green-700"
          >
            Sign in
          </Link>
        </p>

        {/* ==================================================== */}
        {/* SECURITY MESSAGE */}
        {/* ==================================================== */}

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4"
            />
          </svg>

          <span>
            Your information is securely protected
          </span>
        </div>
      </div>
    </main>
  )
}