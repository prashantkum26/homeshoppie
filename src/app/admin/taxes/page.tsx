'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

// Match your Prisma schema for TaxConfiguration
interface TaxConfiguration {
  id: string
  name: string
  type: 'PERCENTAGE' | 'FLAT' | 'COMPOUND'
  rate: number
  isActive: boolean
  applicableIn: string[]
  productTypes: string[]
  minAmount: number | null
  maxAmount: number | null
  validFrom: string
  validUntil: string | null
  regulationRef: string | null
  createdAt: string
  updatedAt: string
}

const DEFAULT_FORM_STATE = {
  name: '',
  type: 'PERCENTAGE',
  rate: 0,
  isActive: true,
  applicableIn: ['ALL'],
  productTypes: ['ALL'],
  minAmount: '',
  maxAmount: '',
  validFrom: new Date().toISOString().split('T')[0],
  validUntil: '',
  regulationRef: ''
}

export default function TaxManagementPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [taxes, setTaxes] = useState<TaxConfiguration[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Slide-over Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<any>(DEFAULT_FORM_STATE)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') router.push('/auth/signin')
    if (sessionStatus === 'authenticated') {
      if (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPER_ADMIN') {
        toast.error('Access denied.')
        router.push('/dashboard')
        return
      }
      fetchTaxes()
    }
  }, [sessionStatus, router, session])

  const fetchTaxes = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/admin/taxes')
      if (!response.ok) throw new Error('Failed to fetch taxes')
      setTaxes(await response.json())
    } catch (error) {
      toast.error('Could not load tax configurations')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenModal = (tax?: TaxConfiguration) => {
    if (tax) {
      setEditingId(tax.id)
      setFormData({
        name: tax.name,
        type: tax.type,
        rate: tax.rate,
        isActive: tax.isActive,
        applicableIn: tax.applicableIn,
        productTypes: tax.productTypes,
        minAmount: tax.minAmount || '',
        maxAmount: tax.maxAmount || '',
        validFrom: new Date(tax.validFrom).toISOString().split('T')[0],
        validUntil: tax.validUntil ? new Date(tax.validUntil).toISOString().split('T')[0] : '',
        regulationRef: tax.regulationRef || ''
      })
    } else {
      setEditingId(null)
      setFormData(DEFAULT_FORM_STATE)
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Clean up empty strings to null for strict Prisma types
    const payload = {
      ...formData,
      rate: Number(formData.rate),
      minAmount: formData.minAmount ? Number(formData.minAmount) : null,
      maxAmount: formData.maxAmount ? Number(formData.maxAmount) : null,
      validUntil: formData.validUntil ? new Date(formData.validUntil).toISOString() : null,
      validFrom: new Date(formData.validFrom).toISOString(),
      regulationRef: formData.regulationRef || null,
    }

    try {
      const url = editingId ? `/api/admin/taxes/${editingId}` : '/api/admin/taxes'
      const method = editingId ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to save tax configuration')
      }

      toast.success(`Tax rule ${editingId ? 'updated' : 'created'} successfully`)
      setIsModalOpen(false)
      fetchTaxes()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/taxes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus })
      })
      if (!response.ok) throw new Error()
      
      toast.success(`Tax rule ${!currentStatus ? 'activated' : 'deactivated'}`)
      fetchTaxes()
    } catch (error) {
      toast.error('Failed to toggle status')
    }
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
        
        {/* Header */}
        <div className="sm:flex sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tax & Compliance</h1>
            <p className="mt-2 text-sm text-gray-700">Manage GST, VAT, and custom tax rules across product categories.</p>
          </div>
          <div className="mt-4 sm:mt-0 flex gap-4 items-center">
            <Link href="/admin" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              &larr; Dashboard
            </Link>
            <button 
              onClick={() => handleOpenModal()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 transition"
            >
              + Create Tax Rule
            </button>
          </div>
        </div>

        {/* Tax Rules Table */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rule Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Applicability</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Validity</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {taxes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                      No tax configurations found. Click "Create Tax Rule" to get started.
                    </td>
                  </tr>
                ) : (
                  taxes.map((tax) => (
                    <tr key={tax.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">{tax.name}</div>
                        <div className="text-xs text-gray-500 font-mono">{tax.regulationRef || 'Custom Rule'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">
                          {tax.rate}{tax.type === 'PERCENTAGE' ? '%' : ' ₹'}
                        </div>
                        <div className="text-xs text-gray-500">{tax.type}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-gray-900 mb-1">
                          <span className="font-semibold text-gray-500">Products:</span> {tax.productTypes.join(', ')}
                        </div>
                        {(tax.minAmount || tax.maxAmount) && (
                          <div className="text-[10px] bg-gray-100 px-2 py-1 rounded inline-block">
                            Limits: ₹{tax.minAmount || 0} - {tax.maxAmount ? `₹${tax.maxAmount}` : '∞'}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(tax.validFrom).toLocaleDateString()} 
                        {' → '} 
                        {tax.validUntil ? new Date(tax.validUntil).toLocaleDateString() : 'Ongoing'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleToggleActive(tax.id, tax.isActive)}
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border transition ${
                            tax.isActive
                              ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
                              : 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200'
                          }`}
                        >
                          {tax.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button 
                          onClick={() => handleOpenModal(tax)}
                          className="text-red-600 hover:text-red-900 font-semibold"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Slide-over Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 overflow-hidden z-50">
          <div className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsModalOpen(false)} />
          <div className="fixed inset-y-0 right-0 max-w-md w-full flex">
            <div className="w-full h-full flex flex-col bg-white shadow-xl">
              
              <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-900">{editingId ? 'Edit Tax Rule' : 'New Tax Rule'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Rule Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-red-500 focus:border-red-500 sm:text-sm"
                    placeholder="e.g. GST 18% Electronics"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Rate *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={formData.rate}
                      onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-red-500 focus:border-red-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Type *</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-red-500 focus:border-red-500 sm:text-sm"
                    >
                      <option value="PERCENTAGE">Percentage (%)</option>
                      <option value="FLAT">Flat Amount (₹)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Valid From *</label>
                    <input
                      type="date"
                      required
                      value={formData.validFrom}
                      onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-red-500 focus:border-red-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Valid Until (Optional)</label>
                    <input
                      type="date"
                      value={formData.validUntil}
                      onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-red-500 focus:border-red-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t pt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Min Cart Amount (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.minAmount}
                      onChange={(e) => setFormData({ ...formData, minAmount: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Max Cart Amount (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.maxAmount}
                      onChange={(e) => setFormData({ ...formData, maxAmount: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Regulation Reference (HSN/SAC Code)</label>
                  <input
                    type="text"
                    value={formData.regulationRef}
                    onChange={(e) => setFormData({ ...formData, regulationRef: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-red-500 focus:border-red-500 sm:text-sm"
                    placeholder="e.g. HSN 8517"
                  />
                </div>

                <div className="flex items-center pt-4 border-t border-gray-200">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900 font-medium">
                    Rule is Active immediately
                  </label>
                </div>

                {/* Footer Buttons */}
                <div className="pt-6 pb-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving Configuration...' : (editingId ? 'Update Tax Rule' : 'Create Tax Rule')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}