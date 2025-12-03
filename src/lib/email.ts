import nodemailer from 'nodemailer'

// Email configuration
const emailConfig = {
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
}

// Create transporter
const transporter = nodemailer.createTransport(emailConfig)

// Verify connection configuration
export const verifyEmailConnection = async (): Promise<boolean> => {
  try {
    await transporter.verify()
    console.log('✅ Email server connection verified')
    return true
  } catch (error) {
    console.error('❌ Email server connection failed:', error)
    return false
  }
}

// Send email function
export const sendEmail = async ({
  to,
  subject,
  html,
  text,
}: {
  to: string
  subject: string
  html?: string
  text?: string
}) => {
  try {
    const info = await transporter.sendMail({
      from: {
        name: process.env.EMAIL_FROM_NAME || 'HomeShoppie',
        address: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@homeshoppie.com',
      },
      to,
      subject,
      html,
      text,
    })

    console.log('✅ Email sent successfully:', info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('❌ Failed to send email:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Password reset email template
export const sendPasswordResetEmail = async (email: string, resetToken: string, userName?: string) => {
  const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`
  
  const subject = 'Reset Your HomeShoppie Password'
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Password Reset - HomeShoppie</title>
        <style>
          body { 
            font-family: 'Inter', Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
            background-color: #f9fafb;
          }
          .email-container { 
            background: white; 
            border-radius: 12px; 
            padding: 40px; 
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          .header { 
            text-align: center; 
            margin-bottom: 30px; 
          }
          .logo { 
            font-size: 28px; 
            font-weight: bold; 
            color: #059669; 
            margin-bottom: 8px;
          }
          .tagline { 
            color: #6b7280; 
            font-size: 14px;
          }
          .content { 
            margin-bottom: 30px; 
          }
          .greeting { 
            font-size: 18px; 
            font-weight: 600; 
            color: #111827; 
            margin-bottom: 16px;
          }
          .message { 
            color: #4b5563; 
            margin-bottom: 24px; 
            line-height: 1.6;
          }
          .cta-button { 
            display: inline-block; 
            background: linear-gradient(135deg, #059669 0%, #047857 100%); 
            color: white; 
            text-decoration: none; 
            padding: 16px 32px; 
            border-radius: 8px; 
            font-weight: 600; 
            font-size: 16px;
            box-shadow: 0 4px 14px 0 rgba(5, 150, 105, 0.39);
            transition: all 0.3s ease;
          }
          .cta-button:hover { 
            transform: translateY(-2px);
            box-shadow: 0 6px 20px 0 rgba(5, 150, 105, 0.45);
          }
          .security-note { 
            background: #fef3c7; 
            border-left: 4px solid #f59e0b; 
            padding: 16px; 
            margin: 24px 0; 
            border-radius: 4px;
          }
          .security-note strong { 
            color: #92400e; 
          }
          .footer { 
            margin-top: 40px; 
            padding-top: 20px; 
            border-top: 1px solid #e5e7eb; 
            font-size: 14px; 
            color: #6b7280; 
            text-align: center;
          }
          .contact-info { 
            margin-top: 20px; 
          }
          .contact-info a { 
            color: #059669; 
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <div class="logo">HomeShoppie</div>
            <div class="tagline">Authentic Traditional Products</div>
          </div>
          
          <div class="content">
            <div class="greeting">
              Hello ${userName ? userName : 'there'}! 👋
            </div>
            
            <div class="message">
              We received a request to reset the password for your HomeShoppie account associated with <strong>${email}</strong>.
            </div>
            
            <div class="message">
              Click the button below to reset your password. This link will expire in <strong>1 hour</strong> for security purposes.
            </div>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}" class="cta-button">Reset My Password</a>
            </div>
            
            <div class="security-note">
              <strong>🔒 Security Note:</strong> If you didn't request this password reset, please ignore this email. Your password will remain unchanged, and your account is secure.
            </div>
            
            <div class="message">
              If the button above doesn't work, copy and paste this link into your browser:
              <br>
              <a href="${resetUrl}" style="color: #059669; word-break: break-all;">${resetUrl}</a>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated message from HomeShoppie. Please do not reply to this email.</p>
            
            <div class="contact-info">
              <p>Need help? Contact us:</p>
              <p>
                📧 <a href="mailto:support@homeshoppie.com">support@homeshoppie.com</a> | 
                📞 +91 98765 43210
              </p>
              <p>
                🏠 123 Traditional Street, Heritage Market, Delhi - 110001
              </p>
            </div>
            
            <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">
              © 2024 HomeShoppie. All rights reserved.
            </p>
          </div>
        </div>
      </body>
    </html>
  `
  
  const text = `
    Hello ${userName ? userName : 'there'}!
    
    We received a request to reset the password for your HomeShoppie account (${email}).
    
    To reset your password, click this link: ${resetUrl}
    
    This link will expire in 1 hour for security purposes.
    
    If you didn't request this password reset, please ignore this email.
    
    Need help? Contact us at support@homeshoppie.com or +91 98765 43210
    
    © 2024 HomeShoppie. All rights reserved.
  `
  
  return sendEmail({
    to: email,
    subject,
    html,
    text,
  })
}

// Welcome email template
export const sendWelcomeEmail = async (email: string, userName: string) => {
  const subject = 'Welcome to HomeShoppie! 🎉'
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to HomeShoppie</title>
        <style>
          body { 
            font-family: 'Inter', Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
            background-color: #f9fafb;
          }
          .email-container { 
            background: white; 
            border-radius: 12px; 
            padding: 40px; 
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          .header { 
            text-align: center; 
            margin-bottom: 30px; 
          }
          .logo { 
            font-size: 28px; 
            font-weight: bold; 
            color: #059669; 
            margin-bottom: 8px;
          }
          .welcome-message { 
            font-size: 24px; 
            font-weight: 700; 
            color: #111827; 
            text-align: center; 
            margin-bottom: 16px;
          }
          .cta-button { 
            display: inline-block; 
            background: linear-gradient(135deg, #059669 0%, #047857 100%); 
            color: white; 
            text-decoration: none; 
            padding: 16px 32px; 
            border-radius: 8px; 
            font-weight: 600; 
            font-size: 16px;
          }
          .features { 
            margin: 32px 0; 
          }
          .feature-item { 
            display: flex; 
            align-items: center; 
            margin-bottom: 16px; 
            padding: 12px; 
            background: #f9fafb; 
            border-radius: 8px;
          }
          .feature-icon { 
            font-size: 24px; 
            margin-right: 12px;
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <div class="logo">HomeShoppie</div>
            <div class="welcome-message">Welcome, ${userName}! 🎉</div>
          </div>
          
          <p>Thank you for joining HomeShoppie, your trusted source for authentic traditional products!</p>
          
          <div class="features">
            <div class="feature-item">
              <div class="feature-icon">🏠</div>
              <div>
                <strong>Authentic Products:</strong> Handmade traditional items with genuine taste
              </div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">🚚</div>
              <div>
                <strong>Fast Delivery:</strong> Fresh products delivered to your doorstep
              </div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">⭐</div>
              <div>
                <strong>Quality Guaranteed:</strong> 100% satisfaction or money back
              </div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">📞</div>
              <div>
                <strong>24/7 Support:</strong> We're here to help whenever you need
              </div>
            </div>
          </div>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/products" class="cta-button">
              Start Shopping Now
            </a>
          </div>
          
          <p style="text-align: center; margin-top: 32px; color: #6b7280;">
            Happy shopping!<br>
            The HomeShoppie Team
          </p>
        </div>
      </body>
    </html>
  `
  
  const text = `
    Welcome to HomeShoppie, ${userName}!
    
    Thank you for joining us. We're excited to bring you authentic traditional products.
    
    Visit us at: ${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}
    
    Happy shopping!
    The HomeShoppie Team
  `
  
  return sendEmail({
    to: email,
    subject,
    html,
    text,
  })
}
