import nodemailer from 'nodemailer'
import { buildVerificationEmail } from '@/lib/email-templates/verification-email'
import { buildPasswordResetEmail } from '@/lib/email-templates/password-reset-email'
import { buildWelcomeEmail } from '@/lib/email-templates/welcome-email'

// ============================================================
// Types
// ============================================================

interface SendEmailOptions {
  to: string
  subject: string
  html?: string
  text?: string
}

interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

interface VerificationEmailOptions {
  email: string
  verificationUrl: string
}

interface PasswordResetEmailOptions {
  email: string
  resetToken: string
  userName: string | null
}

interface WelcomeEmailOptions {
  email: string
  userName: string
}

// ============================================================
// Email configuration
// ============================================================

function getEmailConfig() {
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com'
  const port = Number(process.env.EMAIL_PORT || 587)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid EMAIL_PORT configuration')
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('Email SMTP credentials are not configured')
  }

  return {
    host,
    port,
    secure:
      process.env.EMAIL_SECURE !== undefined
        ? process.env.EMAIL_SECURE === 'true'
        : port === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  }
}

// Create one reusable SMTP transporter.
const transporter = nodemailer.createTransport(getEmailConfig())

// ============================================================
// Sender configuration
// ============================================================

function getSender() {
  const address =
    process.env.EMAIL_FROM ||
    process.env.EMAIL_USER ||
    'noreply@homeshoppie.com'

  const name = process.env.EMAIL_FROM_NAME || 'HomeShoppie'

  return { name, address }
}

// ============================================================
// Base URL
// ============================================================

function getEmailBaseUrl(): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_BASE_URL

  if (!configuredUrl) {
    throw new Error('Email base URL is not configured')
  }

  const url = new URL(configuredUrl)

  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error('Invalid email base URL')
  }

  if (
    process.env.NODE_ENV === 'production' &&
    url.protocol !== 'https:'
  ) {
    throw new Error('Production email URLs must use HTTPS')
  }

  return url.origin
}

// ============================================================
// SMTP connection verification
// ============================================================

export async function verifyEmailConnection(): Promise<boolean> {
  try {
    await transporter.verify()
    return true
  } catch {
    console.error('Email SMTP connection verification failed')
    return false
  }
}

// ============================================================
// Generic email sender
// ============================================================

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: SendEmailOptions): Promise<SendEmailResult> {
  if (!to?.trim() || !subject?.trim()) {
    return {
      success: false,
      error: 'Recipient and subject are required',
    }
  }

  if (!html && !text) {
    return {
      success: false,
      error: 'Email content is required',
    }
  }

  try {
    const info = await transporter.sendMail({
      from: getSender(),
      to,
      subject,
      ...(html ? { html } : {}),
      ...(text ? { text } : {}),
    })

    return {
      success: true,
      messageId: info.messageId,
    }
  } catch (error) {
    // Keep SMTP details in protected server logs.
    console.error('Failed to send email:', error)

    return {
      success: false,
      error: 'Failed to send email',
    }
  }
}

// ============================================================
// Verification email
// ============================================================

export async function sendVerificationEmail({
  email,
  verificationUrl,
}: VerificationEmailOptions): Promise<SendEmailResult> {
  try {
    const baseUrl = getEmailBaseUrl()
    const url = new URL(verificationUrl)

    // Prevent sending links to arbitrary external domains.
    if (url.origin !== baseUrl) {
      return {
        success: false,
        error: 'Invalid verification URL',
      }
    }

    return await sendEmail({
      to: email,
      subject: 'Verify your HomeShoppie account',
      html: buildVerificationEmail({
        verificationUrl: url.toString(),
      }),
      text: [
        'Hello,',
        '',
        'Welcome to HomeShoppie!',
        'Please verify your email address using this link:',
        '',
        url.toString(),
        '',
        'This link expires in 24 hours.',
        '',
        "If you didn't create a HomeShoppie account, you can ignore this email.",
      ].join('\n'),
    })
  } catch (error) {
    console.error('Failed to prepare verification email:', error)

    return {
      success: false,
      error: 'Unable to prepare verification email',
    }
  }
}

// ============================================================
// Password reset email
// ============================================================

export async function sendPasswordResetEmail({
  email,
  resetToken,
  userName,
}: PasswordResetEmailOptions): Promise<SendEmailResult> {
  try {
    if (!resetToken?.trim()) {
      return {
        success: false,
        error: 'Password reset token is required',
      }
    }

    const resetUrl = new URL(
      '/auth/reset-password',
      getEmailBaseUrl(),
    )

    resetUrl.searchParams.set('token', resetToken)

    const url = resetUrl.toString()
    const name = userName?.trim() || 'there'

    return await sendEmail({
      to: email,
      subject: 'Reset your HomeShoppie password',
      html: buildPasswordResetEmail({
        resetUrl: url,
        userName: name,
      }),
      text: [
        `Hello ${name},`,
        '',
        'We received a request to reset your HomeShoppie password.',
        '',
        'Reset your password using this link:',
        url,
        '',
        'This link expires in 1 hour.',
        '',
        "If you didn't request this, you can safely ignore this email.",
      ].join('\n'),
    })
  } catch (error) {
    console.error('Failed to prepare password reset email:', error)

    return {
      success: false,
      error: 'Unable to prepare password reset email',
    }
  }
}

// ============================================================
// Welcome email
// ============================================================

export async function sendWelcomeEmail({
  email,
  userName,
}: WelcomeEmailOptions): Promise<SendEmailResult> {
  try {
    const name = userName.trim() || 'there'
    const shopUrl = new URL('/products', getEmailBaseUrl()).toString()

    return await sendEmail({
      to: email,
      subject: 'Welcome to HomeShoppie!',
      html: buildWelcomeEmail({
        userName: name,
        shopUrl,
      }),
      text: [
        `Welcome to HomeShoppie, ${name}!`,
        '',
        'Thank you for joining us.',
        'Discover traditional favourites and everyday essentials.',
        '',
        `Explore HomeShoppie: ${shopUrl}`,
        '',
        'Happy shopping!',
        'The HomeShoppie Team',
      ].join('\n'),
    })
  } catch (error) {
    console.error('Failed to prepare welcome email:', error)

    return {
      success: false,
      error: 'Unable to prepare welcome email',
    }
  }
}