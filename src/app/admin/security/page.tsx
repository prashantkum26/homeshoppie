'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

// Types matching your exact Prisma Schema
interface UserActivityLog {
  id: string
  userId: string
  action: string
  resource: string | null
  resourceId: string | null
  oldValues: any
  newValues: any
  ipAddress: string
  userAgent: string | null
  createdAt: string
  user: { name: string | null; email: string } | null
}

interface SecurityLog {
  id: string
  userId: string | null
  action: string
  ipAddress: string
  userAgent: string | null
  details: any
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  blocked: boolean
  resolved: boolean
  createdAt: string
  user: { name: string | null; email: string } | null
}

export default function SecurityAuditPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<'ACTIVITY' | 'SECURITY'>('SECURITY')
  
  const [activityLogs, setActivityLogs] = useState<UserActivityLog[]>([])
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Slide-over Modal State
  const [selectedLog, setSelectedLog] = useState<UserActivityLog | SecurityLog | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') router.push('/auth/signin')
    if (sessionStatus === 'authenticated') {
      if (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPER_ADMIN') {
        toast.error('Access denied.')
        router.push('/dashboard')
        return
      }
      fetchLogs()
    }
  }, [sessionStatus, router, session])

  const fetchLogs = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/admin/security/logs')
      if (!response.ok) throw new Error('Failed to fetch logs')
      
      const data = await response.json()
      setActivityLogs(data.activityLogs || [])
      setSecurityLogs(data.securityLogs || [])
    } catch (error) {
      toast.error('Could not load system logs')
    } finally {
      setIsLoading(false)
    }
  }

  // UI Helpers
  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200'
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'LOW': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getActionColor = (action: string) => {
    if (action.includes('SUCCESS') || action === 'CREATE') return 'text-green-600'
    if (action.includes('FAIL') || action.includes('BREACH') || action === 'DELETE') return 'text-red-600'
    if (action.includes('LOCK') || action === 'UPDATE') return 'text-orange-600'
    return 'text-blue-600'
  }

  // Type Guards
  const isSecurityLog = (log: any): log is SecurityLog => 'severity' in log
  const isActivityLog = (log: any): log is UserActivityLog => 'resource' in log

  // Filtering
  const filteredSecurity = securityLogs.filter(log => 
    `${log.user?.email || ''} ${log.action} ${log.ipAddress}`.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredActivity = activityLogs.filter(log => 
    `${log.user?.email || ''} ${log.action} ${log.resource || ''}`.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
            <h1 className="text-2xl font-bold text-gray-900">System Logs</h1>
            <p className="mt-2 text-sm text-gray-700">Monitor security alerts and track staff activity across the platform.</p>
          </div>
          <div className="mt-4 sm:mt-0 flex gap-4 items-center">
            <Link href="/admin" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              &larr; Dashboard
            </Link>
            <button 
              onClick={() => fetchLogs()}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Tabs & Search */}
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex flex-col sm:flex-row justify-between gap-4 border border-gray-200">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-md">
            <button
              onClick={() => setActiveTab('SECURITY')}
              className={`px-4 py-2 text-sm font-bold rounded-md transition ${activeTab === 'SECURITY' ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Security Alerts
            </button>
            <button
              onClick={() => setActiveTab('ACTIVITY')}
              className={`px-4 py-2 text-sm font-bold rounded-md transition ${activeTab === 'ACTIVITY' ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Activity Audit
            </button>
          </div>
          <div className="sm:w-96">
            <input
              type="text"
              placeholder="Search user, IP, action..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
            />
          </div>
        </div>

        {/* Dynamic Table based on Tab */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Timestamp</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    {activeTab === 'SECURITY' ? 'IP Address' : 'Resource'}
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">
                    {activeTab === 'SECURITY' ? 'Severity' : 'Details'}
                  </th>
                  <th className="px-6 py-3 text-right"><span className="sr-only">Inspect</span></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                
                {activeTab === 'SECURITY' && filteredSecurity.map(log => (
                  <tr key={log.id} onClick={() => setSelectedLog(log)} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(log.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.user?.email || 'System/Guest'}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${getActionColor(log.action)}`}>
                      {log.action}
                      {log.blocked && <span className="ml-2 text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded">BLOCKED</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">{log.ipAddress}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold border ${getSeverityBadge(log.severity)}`}>
                        {log.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-400 hover:text-gray-900">Inspect &rarr;</td>
                  </tr>
                ))}

                {activeTab === 'ACTIVITY' && filteredActivity.map(log => (
                  <tr key={log.id} onClick={() => setSelectedLog(log)} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(log.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.user?.email || 'Unknown User'}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${getActionColor(log.action)}`}>{log.action}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                      {log.resource || 'SYSTEM'} 
                      {log.resourceId && <span className="ml-1 text-xs text-gray-400 font-mono">({log.resourceId.slice(-6)})</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-xs text-gray-500">
                      {(log.oldValues || log.newValues) ? 'View Changes' : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-400 hover:text-gray-900">Inspect &rarr;</td>
                  </tr>
                ))}

                {((activeTab === 'SECURITY' && filteredSecurity.length === 0) || (activeTab === 'ACTIVITY' && filteredActivity.length === 0)) && (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">No logs found matching your criteria.</td></tr>
                )}

              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Slide-over Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 overflow-hidden z-50">
          <div className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setSelectedLog(null)} />
          <div className="fixed inset-y-0 right-0 max-w-lg w-full flex">
            <div className="w-full h-full flex flex-col bg-white shadow-xl">
              
              <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-900">Log Inspector</h2>
                <button onClick={() => setSelectedLog(null)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Event Summary Box */}
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                  <div className="flex justify-between border-b pb-3 mb-3">
                    <div>
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">Action Taken</p>
                      <p className={`text-lg font-bold ${getActionColor(selectedLog.action)}`}>{selectedLog.action}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">Timestamp</p>
                      <p className="text-sm font-medium">{new Date(selectedLog.createdAt).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="block text-gray-500 mb-1">Actor (Email)</span>
                      <span className="font-medium">{selectedLog.user?.email || 'System / Unauthenticated'}</span>
                    </div>
                    <div>
                      <span className="block text-gray-500 mb-1">IP Address</span>
                      <span className="font-mono">{selectedLog.ipAddress || 'Unknown'}</span>
                    </div>
                    <div>
                      <span className="block text-gray-500 mb-1">User Agent</span>
                      <span className="truncate block text-xs" title={selectedLog.userAgent || ''}>{selectedLog.userAgent || 'N/A'}</span>
                    </div>
                    
                    {/* Security Specific Data */}
                    {isSecurityLog(selectedLog) && (
                      <div>
                        <span className="block text-gray-500 mb-1">Severity / Status</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${getSeverityBadge(selectedLog.severity)}`}>
                          {selectedLog.severity}
                        </span>
                        {selectedLog.blocked && <span className="ml-2 text-xs font-bold text-red-600">BLOCKED</span>}
                      </div>
                    )}

                    {/* Activity Specific Data */}
                    {isActivityLog(selectedLog) && selectedLog.resource && (
                      <div>
                        <span className="block text-gray-500 mb-1">Resource & ID</span>
                        <span className="font-bold">{selectedLog.resource}</span>
                        <br/><span className="font-mono text-xs bg-gray-200 px-1 rounded">{selectedLog.resourceId}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* JSON Data Payloads */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 border-b pb-2 mb-3">Technical Metadata</h3>
                  
                  {isSecurityLog(selectedLog) && (
                    <div className="bg-gray-900 rounded-md p-4 overflow-x-auto">
                      <p className="text-xs text-gray-400 mb-2">// Request Details Payload</p>
                      <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                        {selectedLog.details ? JSON.stringify(selectedLog.details, null, 2) : 'No payload recorded.'}
                      </pre>
                    </div>
                  )}

                  {isActivityLog(selectedLog) && (
                    <div className="space-y-4">
                      {selectedLog.oldValues && (
                        <div className="bg-red-50 rounded-md p-4 overflow-x-auto border border-red-100">
                          <p className="text-xs text-red-800 font-bold mb-2">Previous State (Before)</p>
                          <pre className="text-xs text-red-600 font-mono whitespace-pre-wrap">
                            {JSON.stringify(selectedLog.oldValues, null, 2)}
                          </pre>
                        </div>
                      )}
                      {selectedLog.newValues && (
                        <div className="bg-green-50 rounded-md p-4 overflow-x-auto border border-green-100">
                          <p className="text-xs text-green-800 font-bold mb-2">New State (After)</p>
                          <pre className="text-xs text-green-600 font-mono whitespace-pre-wrap">
                            {JSON.stringify(selectedLog.newValues, null, 2)}
                          </pre>
                        </div>
                      )}
                      {!selectedLog.oldValues && !selectedLog.newValues && (
                        <p className="text-sm text-gray-500 italic">No state changes recorded for this event.</p>
                      )}
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}