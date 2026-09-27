'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

// Types based on your Prisma Schema
type Role = 'USER' | 'ADMIN' | 'MODERATOR' | 'SUPER_ADMIN'

interface User {
  id: string
  name: string | null
  email: string
  phone: string | null
  role: Role
  isActive: boolean
  isLocked: boolean
  failedLoginCount: number
  lastLoginAt: string | null
  createdAt: string
  _count?: {
    orders: number
  }
}

export default function UserManagementPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }
    
    if (sessionStatus === 'authenticated') {
      if (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPER_ADMIN') {
        toast.error('Access denied. Admin privileges required.')
        router.push('/dashboard')
        return
      }
      fetchUsers()
    }
  }, [sessionStatus, router, session])

  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/admin/users')
      if (!response.ok) throw new Error('Failed to fetch users')
      const data = await response.json()
      setUsers(data)
    } catch (error) {
      toast.error('Could not load users')
    } finally {
      setIsLoading(false)
    }
  }

  const updateUser = async (id: string, updates: Partial<User>) => {
    // Prevent self-demotion or self-locking
    if (id === session?.user?.id && (updates.role === 'USER' || updates.isActive === false || updates.isLocked === true)) {
      toast.error("You cannot demote, deactivate, or lock your own account.")
      return
    }

    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) throw new Error('Failed to update user')
      
      toast.success('User updated successfully')
      
      // Update local state instantly
      setUsers(users.map(u => u.id === id ? { ...u, ...updates } : u))
      if (selectedUser && selectedUser.id === id) {
        setSelectedUser({ ...selectedUser, ...updates })
      }
    } catch (error) {
      toast.error('Failed to update user')
    }
  }

  // Filter Logic
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone?.includes(searchQuery)
    const matchesRole = roleFilter === 'ALL' || user.role === roleFilter
    
    let matchesStatus = true
    if (statusFilter === 'LOCKED') matchesStatus = user.isLocked
    if (statusFilter === 'INACTIVE') matchesStatus = !user.isActive
    if (statusFilter === 'ACTIVE') matchesStatus = user.isActive && !user.isLocked

    return matchesSearch && matchesRole && matchesStatus
  })

  // UI Helpers
  const getRoleBadgeColor = (role: Role) => {
    const colors = {
      SUPER_ADMIN: 'bg-purple-100 text-purple-800 border-purple-200',
      ADMIN: 'bg-red-100 text-red-800 border-red-200',
      MODERATOR: 'bg-blue-100 text-blue-800 border-blue-200',
      USER: 'bg-gray-100 text-gray-800 border-gray-200',
    }
    return colors[role]
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
            <h1 className="text-2xl font-bold text-gray-900">Customer & User Management</h1>
            <p className="mt-2 text-sm text-gray-700">
              Manage accounts, roles, security statuses, and view customer profiles.
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <Link href="/admin" className="text-sm font-medium text-red-600 hover:text-red-500">
              &larr; Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex flex-col sm:flex-row gap-4 border border-gray-200">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Search Users</label>
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
            />
          </div>
          <div className="sm:w-48">
            <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
            >
              <option value="ALL">All Roles</option>
              <option value="USER">Customers (User)</option>
              <option value="MODERATOR">Moderators</option>
              <option value="ADMIN">Admins</option>
              <option value="SUPER_ADMIN">Super Admins</option>
            </select>
          </div>
          <div className="sm:w-48">
            <label className="block text-xs font-medium text-gray-700 mb-1">Account Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active & Unlocked</option>
              <option value="INACTIVE">Deactivated</option>
              <option value="LOCKED">Security Locked</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Orders</th>
                  <th className="relative px-6 py-3"><span className="sr-only">Manage</span></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                      No users found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr 
                      key={user.id} 
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedUser(user)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-bold">
                            {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.name || 'Unnamed User'}
                              {session?.user?.id === user.id && <span className="ml-2 text-xs text-red-500 font-semibold">(You)</span>}
                            </div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeColor(user.role)}`}>
                          {user.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {!user.isActive ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Deactivated</span>
                        ) : user.isLocked ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">Locked</span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Active</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">
                        {user._count?.orders || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button className="text-red-600 hover:text-red-900">Manage</button>
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
      {selectedUser && (
        <div className="fixed inset-0 overflow-hidden z-50">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setSelectedUser(null)} />
            <div className="fixed inset-y-0 right-0 pl-10 max-w-2xl w-full flex">
              <div className="w-full h-full flex flex-col bg-white shadow-xl">
                
                {/* Modal Header */}
                <div className="px-6 py-6 bg-gray-50 border-b border-gray-200 flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 flex-shrink-0 bg-red-100 rounded-full flex items-center justify-center text-red-700 font-bold text-xl">
                      {selectedUser.name ? selectedUser.name.charAt(0).toUpperCase() : selectedUser.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        {selectedUser.name || 'Unnamed User'}
                        {session?.user?.id === selectedUser.id && <span className="ml-2 text-sm text-red-500 font-normal">(This is you)</span>}
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">{selectedUser.email}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-gray-500">
                    <span className="text-2xl">&times;</span>
                  </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
                  
                  {/* Profile Info */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide border-b pb-2">Profile Details</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500 font-medium">Phone Number</p>
                        <p className="text-gray-900">{selectedUser.phone || 'Not provided'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 font-medium">Total Orders</p>
                        <p className="text-gray-900">{selectedUser._count?.orders || 0} orders</p>
                      </div>
                      <div>
                        <p className="text-gray-500 font-medium">Account Created</p>
                        <p className="text-gray-900">{new Date(selectedUser.createdAt).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 font-medium">Last Login</p>
                        <p className="text-gray-900">{selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleString() : 'Never logged in'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Role Management */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide border-b pb-2">Access & Permissions</h3>
                    <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                      <label className="block text-sm font-medium text-gray-700 mb-2">User Role</label>
                      <select
                        value={selectedUser.role}
                        disabled={session?.user?.id === selectedUser.id}
                        onChange={(e) => updateUser(selectedUser.id, { role: e.target.value as Role })}
                        className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100 disabled:text-gray-500"
                      >
                        <option value="USER">Customer (User)</option>
                        <option value="MODERATOR">Moderator</option>
                        <option value="ADMIN">Admin</option>
                        <option value="SUPER_ADMIN">Super Admin</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-2">
                        Changing roles immediately affects the user's access to the admin dashboard.
                      </p>
                    </div>
                  </div>

                  {/* Security Management */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide border-b pb-2">Account Security</h3>
                    
                    <div className="space-y-4">
                      {/* Active Status */}
                      <div className="flex items-center justify-between bg-white border border-gray-200 p-4 rounded-md">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Account Active</p>
                          <p className="text-xs text-gray-500">Inactive accounts cannot log in or make purchases.</p>
                        </div>
                        <button
                          onClick={() => updateUser(selectedUser.id, { isActive: !selectedUser.isActive })}
                          disabled={session?.user?.id === selectedUser.id}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${selectedUser.isActive ? 'bg-green-600' : 'bg-gray-200'}`}
                        >
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${selectedUser.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      {/* Locked Status */}
                      <div className="flex items-center justify-between bg-white border border-red-200 p-4 rounded-md bg-red-50">
                        <div>
                          <p className="text-sm font-medium text-gray-900 text-red-800">Security Lock</p>
                          <p className="text-xs text-red-600">Failed login attempts: <strong>{selectedUser.failedLoginCount}</strong></p>
                        </div>
                        <button
                          onClick={() => updateUser(selectedUser.id, { isLocked: !selectedUser.isLocked })}
                          disabled={session?.user?.id === selectedUser.id}
                          className={`px-4 py-2 text-sm font-medium rounded-md shadow-sm focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                            selectedUser.isLocked 
                              ? 'bg-green-600 text-white hover:bg-green-700' 
                              : 'bg-red-600 text-white hover:bg-red-700'
                          }`}
                        >
                          {selectedUser.isLocked ? 'Unlock Account' : 'Force Lock Account'}
                        </button>
                      </div>

                    </div>
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