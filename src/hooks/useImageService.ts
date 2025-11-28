'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { imageService } from '../lib/imageService'
import toast from 'react-hot-toast'

interface UseImageServiceReturn {
  isAuthenticated: boolean
  isLoading: boolean
  login: () => Promise<boolean>
  error: string | null
}

export function useImageService(): UseImageServiceReturn {
  const { data: session } = useSession()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const login = useCallback(async (): Promise<boolean> => {
    if (!session?.user?.email) {
      setError('User session not found')
      return false
    }

    try {
      setIsLoading(true)
      setError(null)

      // Generate a username from email
      const username = session.user.email.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '_')
      const email = session.user.email
      
      // Use a default password for homeshoppie users
      // In production, you might want to generate a more secure password or use JWT
      const password = `homeshoppie_${session.user.id || 'user'}_${Date.now()}`

      try {
        // Try to register first (in case the user doesn't exist)
        await imageService.register(username, email, password)
        setIsAuthenticated(true)
        return true
      } catch (registerError: any) {
        // If registration fails (user might already exist), try to login
        if (registerError.message.includes('already exists') || registerError.message.includes('duplicate')) {
          try {
            await imageService.login(email, password)
            setIsAuthenticated(true)
            return true
          } catch (loginError: any) {
            // If login with new password fails, try with a default pattern
            const fallbackPassword = `homeshoppie_${username}`
            try {
              await imageService.login(email, fallbackPassword)
              setIsAuthenticated(true)
              return true
            } catch (fallbackError: any) {
              console.error('All authentication attempts failed:', fallbackError)
              setError('Failed to authenticate with image service')
              return false
            }
          }
        } else {
          throw registerError
        }
      }
    } catch (err: any) {
      console.error('Image service authentication error:', err)
      setError(err.message || 'Authentication failed')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [session])

  // Auto-login when session is available
  useEffect(() => {
    if (session?.user?.email && session.user.role === 'ADMIN' && !isAuthenticated && !isLoading) {
      login().then((success) => {
        if (!success) {
          console.warn('Failed to auto-authenticate with image service')
        }
      })
    }
  }, [session, isAuthenticated, isLoading, login])

  return {
    isAuthenticated,
    isLoading,
    login,
    error
  }
}

export default useImageService
