'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

// Types based on your Prisma Schema
type ContactStatus = 'NEW' | 'IN_PROGRESS' | 'WAITING_FOR_CUSTOMER' | 'RESOLVED' | 'CLOSED' | 'SPAM'
type ContactPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
type ContactCategory = 'GENERAL' | 'PRODUCT_INQUIRY' | 'ORDER_SUPPORT' | 'TECHNICAL_ISSUE' | 'BILLING' | 'PARTNERSHIP' | 'FEEDBACK' | 'COMPLAINT' | 'BULK_ORDER' | 'OTHER'

interface ContactMessage {
  id: string
  name: string
  email: string
  phone: string | null
  subject: string
  message: string
  category: ContactCategory
  priority: ContactPriority
  status: ContactStatus
  notes: string | null
  createdAt: string
  assignedTo: string | null
}

export default function ContactManagementPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null)
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL')

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }
    
    if (sessionStatus === 'authenticated') {
      if (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPER_ADMIN') {
        toast.error('Access denied.')
        router.push('/dashboard')
        return
      }
      fetchMessages()
    }
  }, [sessionStatus, router, session])

  const fetchMessages = async () => {
    try {
      setIsLoading(true)
      // In a real app, you might pass filters as URL queries to the API
      const response = await fetch('/api/admin/messages')
      if (!response.ok) throw new Error('Failed to fetch messages')
      const data = await response.json()
      setMessages(data)
    } catch (error) {
      toast.error('Could not load messages')
    } finally {
      setIsLoading(false)
    }
  }

  const updateMessage = async (id: string, updates: Partial<ContactMessage>) => {
    try {
      const response = await fetch(`/api/admin/messages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) throw new Error('Failed to update message')
      
      toast.success('Ticket updated successfully')
      
      // Update local state to reflect changes instantly
      setMessages(messages.map(msg => msg.id === id ? { ...msg, ...updates } : msg))
      if (selectedMessage && selectedMessage.id === id) {
        setSelectedMessage({ ...selectedMessage, ...updates })
      }
    } catch (error) {
      toast.error('Failed to update ticket')
    }
  }

  // Filter Logic
  const filteredMessages = messages.filter(msg => {
    const matchesStatus = statusFilter === 'ALL' || msg.status === statusFilter
    const matchesPriority = priorityFilter === 'ALL' || msg.priority === priorityFilter
    return matchesStatus && matchesPriority
  })

  // UI Helpers
  const getStatusColor = (status: ContactStatus) => {
    const colors = {
      NEW: 'bg-blue-100 text-blue-800 border-blue-200',
      IN_PROGRESS: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      WAITING_FOR_CUSTOMER: 'bg-purple-100 text-purple-800 border-purple-200',
      RESOLVED: 'bg-green-100 text-green-800 border-green-200',
      CLOSED: 'bg-gray-100 text-gray-800 border-gray-200',
      SPAM: 'bg-red-100 text-red-800 border-red-200',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getPriorityColor = (priority: ContactPriority) => {
    const colors = {
      LOW: 'text-gray-500 bg-gray-50',
      NORMAL: 'text-blue-600 bg-blue-50',
      HIGH: 'text-orange-600 bg-orange-50',
      URGENT: 'text-red-600 bg-red-50 font-bold',
    }
    return colors[priority] || 'text-gray-500'
  }

  if (sessionStatus === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <div className="sm:flex sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customer Support Inbox</h1>
            <p className="mt-2 text-sm text-gray-700">
              Manage incoming inquiries, product questions, and support tickets.
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <Link href="/admin" className="text-sm font-medium text-red-600 hover:text-red-500">
              &larr; Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex flex-col sm:flex-row gap-4 border border-gray-200">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="NEW">New</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="WAITING_FOR_CUSTOMER">Waiting for Customer</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-sm border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="NORMAL">Normal</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>

        {/* Messages Table */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject / Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="relative px-6 py-3"><span className="sr-only">View</span></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMessages.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                      No messages found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredMessages.map((msg) => (
                    <tr 
                      key={msg.id} 
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedMessage(msg)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{msg.name}</div>
                        <div className="text-sm text-gray-500">{msg.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 font-medium truncate max-w-xs">{msg.subject}</div>
                        <div className="text-xs text-gray-500">{msg.category.replace('_', ' ')}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(msg.status)}`}>
                          {msg.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${getPriorityColor(msg.priority)}`}>
                          {msg.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(msg.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button className="text-red-600 hover:text-red-900">View</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Slide-over Detail Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 overflow-hidden z-50">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setSelectedMessage(null)} />
            <div className="fixed inset-y-0 right-0 pl-10 max-w-2xl w-full flex">
              <div className="w-full h-full flex flex-col bg-white shadow-xl">
                
                {/* Modal Header */}
                <div className="px-6 py-6 bg-gray-50 border-b border-gray-200 flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedMessage.subject}</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      From: {selectedMessage.name} ({selectedMessage.email})
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedMessage(null)}
                    className="text-gray-400 hover:text-gray-500 focus:outline-none"
                  >
                    <span className="text-2xl">&times;</span>
                  </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto px-6 py-6">
                  
                  {/* Management Controls */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200 flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Update Status</label>
                      <select
                        value={selectedMessage.status}
                        onChange={(e) => updateMessage(selectedMessage.id, { status: e.target.value as ContactStatus })}
                        className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                      >
                        <option value="NEW">New</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="WAITING_FOR_CUSTOMER">Waiting for Customer</option>
                        <option value="RESOLVED">Resolved</option>
                        <option value="CLOSED">Closed</option>
                        <option value="SPAM">Spam</option>
                      </select>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Update Priority</label>
                      <select
                        value={selectedMessage.priority}
                        onChange={(e) => updateMessage(selectedMessage.id, { priority: e.target.value as ContactPriority })}
                        className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                      >
                        <option value="LOW">Low</option>
                        <option value="NORMAL">Normal</option>
                        <option value="HIGH">High</option>
                        <option value="URGENT">Urgent</option>
                      </select>
                    </div>
                  </div>

                  {/* Message Content */}
                  <div className="mb-8">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2 uppercase tracking-wide">Message Content</h3>
                    <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap">
                      {selectedMessage.message}
                    </div>
                  </div>

                  {/* Admin Notes Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2 uppercase tracking-wide">Internal Notes (Staff Only)</h3>
                    <textarea
                      className="w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 text-sm"
                      rows={4}
                      placeholder="Add private notes, resolution details, or reminders here..."
                      defaultValue={selectedMessage.notes || ''}
                      onBlur={(e) => {
                        if (e.target.value !== selectedMessage.notes) {
                          updateMessage(selectedMessage.id, { notes: e.target.value })
                        }
                      }}
                    />
                    <p className="text-xs text-gray-500 mt-1">Notes are saved automatically when you click outside the box.</p>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}