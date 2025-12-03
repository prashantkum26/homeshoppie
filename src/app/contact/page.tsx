'use client'

import { useState } from 'react'
import { 
  PhoneIcon, 
  EnvelopeIcon, 
  MapPinIcon, 
  ClockIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'

interface ContactForm {
  name: string
  email: string
  phone: string
  subject: string
  message: string
  category: string
}

export default function ContactPage() {
  const [formData, setFormData] = useState<ContactForm>({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
    category: 'GENERAL'
  })
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }
    
    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required'
    }
    
    if (!formData.message.trim()) {
      newErrors.message = 'Message is required'
    } else if (formData.message.length < 10) {
      newErrors.message = 'Message must be at least 10 characters'
    }
    
    if (formData.phone && !/^[\+]?[91]?[0-9]{10}$/.test(formData.phone.replace(/\s|-/g, ''))) {
      newErrors.phone = 'Please enter a valid phone number'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      toast.error('Please fix the errors below')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (!response.ok) {
        if (response.status === 429) {
          toast.error(result.message || 'Too many messages sent. Please try again later.')
        } else {
          toast.error(result.message || 'Failed to send message')
        }
        return
      }

      setSubmitted(true)
      toast.success(result.message || 'Message sent successfully!')
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: '',
        category: 'GENERAL'
      })
    } catch (error) {
      console.error('Error submitting contact form:', error)
      toast.error('Failed to send message. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const contactInfo = [
    {
      icon: PhoneIcon,
      title: 'Phone',
      details: ['+91 98765 43210', '+91 98765 43211'],
      description: 'Call us for immediate assistance'
    },
    {
      icon: EnvelopeIcon,
      title: 'Email',
      details: ['info@homeshoppie.com', 'support@homeshoppie.com'],
      description: 'Send us an email anytime'
    },
    {
      icon: MapPinIcon,
      title: 'Address',
      details: ['123 Traditional Street', 'Heritage Market, Delhi - 110001'],
      description: 'Visit our store location'
    },
    {
      icon: ClockIcon,
      title: 'Business Hours',
      details: ['Mon - Sat: 9:00 AM - 8:00 PM', 'Sunday: 10:00 AM - 6:00 PM'],
      description: 'We\'re open during these hours'
    }
  ]

  const subjects = [
    'General Inquiry',
    'Product Question',
    'Order Support',
    'Bulk Orders',
    'Partnership',
    'Feedback',
    'Technical Issue',
    'Other'
  ]

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Message Sent!</h2>
          <p className="text-gray-600 mb-6">
            Thank you for reaching out to us. We've received your message and will respond within 24 hours.
          </p>
          <button
            onClick={() => setSubmitted(false)}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
          >
            Send Another Message
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Contact Us</h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              We'd love to hear from you. Get in touch with our friendly team for any questions or support.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div className="bg-white">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <ChatBubbleLeftRightIcon className="h-6 w-6 text-green-600" />
                Send us a Message
              </h2>
              <p className="text-gray-600">
                Fill out the form below and we'll get back to you as soon as possible.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  id="name"
                  name="name"
                  type="text"
                  label="Full Name"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={handleInputChange}
                  error={errors.name}
                  required
                  fullWidth
                />
                
                <Input
                  id="email"
                  name="email"
                  type="email"
                  label="Email Address"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleInputChange}
                  error={errors.email}
                  required
                  fullWidth
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  label="Phone Number"
                  placeholder="Enter your phone number"
                  value={formData.phone}
                  onChange={handleInputChange}
                  error={errors.phone}
                  helperText="Optional - for faster response"
                  fullWidth
                />
                
                <div className="space-y-1">
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                    Category
                  </label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                  >
                    <option value="GENERAL">General Inquiry</option>
                    <option value="PRODUCT_INQUIRY">Product Question</option>
                    <option value="ORDER_SUPPORT">Order Support</option>
                    <option value="TECHNICAL_ISSUE">Technical Issue</option>
                    <option value="BILLING">Billing</option>
                    <option value="PARTNERSHIP">Partnership</option>
                    <option value="FEEDBACK">Feedback</option>
                    <option value="COMPLAINT">Complaint</option>
                    <option value="BULK_ORDER">Bulk Orders</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <Input
                id="subject"
                name="subject"
                type="text"
                label="Subject"
                placeholder="Brief description of your inquiry"
                value={formData.subject}
                onChange={handleInputChange}
                error={errors.subject}
                required
                fullWidth
              />

              <Textarea
                id="message"
                name="message"
                label="Message"
                placeholder="Tell us how we can help you..."
                rows={6}
                value={formData.message}
                onChange={handleInputChange}
                error={errors.message}
                helperText={`${formData.message.length}/2000 characters`}
                required
                fullWidth
                resize="none"
              />

              <Button
                type="submit"
                loading={isSubmitting}
                disabled={isSubmitting}
                fullWidth
                size="lg"
              >
                Send Message
              </Button>

              <p className="text-sm text-gray-500">
                * Required fields. We'll respond within 24 hours during business days.
              </p>
            </form>
          </div>

          {/* Contact Information */}
          <div>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Get in Touch</h2>
              <p className="text-gray-600">
                Reach out to us through any of these channels. We're here to help with all your traditional food needs.
              </p>
            </div>

            <div className="space-y-8">
              {contactInfo.map((info, index) => {
                const IconComponent = info.icon
                return (
                  <div key={index} className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                        <IconComponent className="h-6 w-6 text-green-600" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {info.title}
                      </h3>
                      <p className="text-sm text-gray-500 mb-2">
                        {info.description}
                      </p>
                      {info.details.map((detail, idx) => (
                        <p key={idx} className="text-gray-900 font-medium">
                          {detail}
                        </p>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Additional Info */}
            <div className="mt-8 p-6 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Why Choose HomeShoppie?
              </h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-green-500 flex-shrink-0" />
                  Authentic traditional products
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-green-500 flex-shrink-0" />
                  Made with organic ingredients
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-green-500 flex-shrink-0" />
                  Fast and reliable delivery
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-green-500 flex-shrink-0" />
                  24/7 customer support
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-green-500 flex-shrink-0" />
                  100% satisfaction guarantee
                </li>
              </ul>
            </div>

            {/* Emergency Contact */}
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="text-md font-semibold text-red-800 mb-2">
                🚨 Emergency Support
              </h4>
              <p className="text-red-700 text-sm">
                For urgent order issues or emergencies, call our 24/7 helpline: 
                <span className="font-bold"> +91 98765 43210</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-gray-600">
              Quick answers to common questions
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                question: "What are your delivery areas?",
                answer: "We deliver across India. Delivery times vary from 1-7 days depending on location."
              },
              {
                question: "Do you offer bulk discounts?",
                answer: "Yes! Contact us for special pricing on bulk orders above ₹5,000."
              },
              {
                question: "Are your products organic?",
                answer: "Most of our products are made with organic ingredients. Check individual product descriptions."
              },
              {
                question: "What's your return policy?",
                answer: "We offer 7-day returns for unopened products. Contact us for return authorization."
              },
              {
                question: "Do you have a mobile app?",
                answer: "Currently we operate through our website. A mobile app is coming soon!"
              },
              {
                question: "Can I track my order?",
                answer: "Yes, you'll receive tracking information via email once your order ships."
              }
            ].map((faq, index) => (
              <div key={index} className="bg-white p-6 rounded-lg shadow-sm">
                <h3 className="text-md font-semibold text-gray-900 mb-2">
                  {faq.question}
                </h3>
                <p className="text-gray-600 text-sm">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
