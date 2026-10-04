'use client'

import { useState } from 'react'
import Link from 'next/link'
import { 
  PhoneIcon, 
  EnvelopeIcon, 
  MapPinIcon, 
  ClockIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ArrowLeftIcon
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
      details: ['+91 00000 00000'],
      description: 'Call us for immediate assistance'
    },
    {
      icon: EnvelopeIcon,
      title: 'Email',
      details: ['support@homeshoppie.com'],
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

  if (submitted) {
    return (
      <main className="min-h-screen bg-[#faf9f5] flex items-center justify-center px-4 py-20">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200/80 shadow-sm p-8 text-center animate-fadeIn">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-5">
            <CheckCircleIcon className="h-9 w-9" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-950 mb-2">Message Sent!</h2>
          <p className="text-sm text-slate-600 mb-8 leading-relaxed">
            Thank you for reaching out to us. We have received your message and will respond within 24 hours.
          </p>
          <button
            onClick={() => setSubmitted(false)}
            className="w-full inline-flex items-center justify-center h-11 rounded-xl bg-slate-950 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-sm"
          >
            Send Another Message
          </button>
        </div>
      </main>
    )
  }

  return (
    <div className="bg-[#faf9f5] min-h-screen text-slate-950 pb-24">
      
      {/* Hero Header */}
      <section className="relative overflow-hidden border-b border-stone-200/70 bg-white py-12 sm:py-16">
        <div className="absolute right-0 -top-32 h-80 w-80 rounded-full bg-emerald-100/40 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-950 transition-colors uppercase tracking-wider"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              <span>Back to Home</span>
            </Link>
          </div>

          <div className="text-center max-w-2xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-800">
                Customer Support Hub
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950">
              Get in Touch with Us
            </h1>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              We'd love to hear from you. Get in touch with our friendly team for any questions or support.
            </p>
          </div>
        </div>
      </section>

      {/* Main Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          
          {/* Contact Form Column */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-xs">
            <div className="mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-950 mb-2 flex items-center gap-2.5">
                <ChatBubbleLeftRightIcon className="h-6 w-6 text-primary-600" />
                Send us a Message
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Fill out the form below and our team will get back to you promptly.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
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
                
                <div className="space-y-1.5">
                  <label htmlFor="category" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Inquiry Category
                  </label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
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
                rows={5}
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

              <p className="text-xs text-slate-400">
                * Required fields. We protect your privacy and respond within 24 hours.
              </p>
            </form>
          </div>

          {/* Contact Information & Highlights Column */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Channels Box */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6">
              <h3 className="text-lg font-bold text-slate-950 mb-2">Direct Channels</h3>
              
              <div className="space-y-6">
                {contactInfo.map((info, index) => {
                  const IconComponent = info.icon
                  return (
                    <div key={index} className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-200/60">
                          <IconComponent className="h-5 w-5 text-amber-700" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-slate-900 mb-0.5">
                          {info.title}
                        </h4>
                        <p className="text-xs text-slate-400 mb-1">
                          {info.description}
                        </p>
                        {info.details.map((detail, idx) => (
                          <p key={idx} className="text-slate-700 font-semibold text-sm">
                            {detail}
                          </p>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Why Choose Us Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs">
              <h3 className="text-base font-bold text-slate-950 mb-4">
                Why Choose HomeShoppie?
              </h3>
              <ul className="space-y-3 text-xs sm:text-sm text-slate-600">
                {[
                  "Authentic traditional products",
                  "Made with organic ingredients",
                  "Fast and reliable delivery across India",
                  "Dedicated customer support team",
                  "100% satisfaction guarantee"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2.5">
                    <CheckCircleIcon className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Emergency Support Notice */}
            <div className="p-5 bg-rose-50/80 border border-rose-200/60 rounded-3xl">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-800 mb-1">
                🚨 Urgent Order Support
              </h4>
              <p className="text-rose-700 text-xs sm:text-sm leading-relaxed">
                For immediate order dispatch modifications or urgent help, call our helpline: 
                <span className="font-bold block mt-0.5 text-slate-950">+91 00000 00000</span>
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 mt-16 border-t border-stone-200/70">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 mb-2">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Quick answers to common questions about our policies and services.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              question: "What are your delivery areas?",
              answer: "Chúng tôi delivers across India. Delivery times vary from 1-7 days depending on your location."
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
              question: "How can I track my shipment?",
              answer: "Visit our Track Order page to check real-time courier statuses using your Order ID."
            },
            {
              question: "Is Cash on Delivery available?",
              answer: "Yes, COD is available for eligible pin codes across India during checkout."
            }
          ].map((faq, index) => (
            <div key={index} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <h3 className="text-sm font-bold text-slate-900 mb-2">
                {faq.question}
              </h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}