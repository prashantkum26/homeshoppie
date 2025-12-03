'use client'

import { forwardRef, useState } from 'react'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  error?: string
  helperText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  variant?: 'default' | 'filled' | 'outline'
  inputSize?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  showPasswordToggle?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  className,
  type = 'text',
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  variant = 'default',
  inputSize = 'md',
  fullWidth = false,
  showPasswordToggle = false,
  disabled,
  required,
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false)
  const [isFocused, setIsFocused] = useState(false)

  const isPassword = type === 'password'
  const inputType = isPassword && showPassword ? 'text' : type

  const sizeClasses: Record<'sm' | 'md' | 'lg', string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base'
  }

  const variantClasses: Record<'default' | 'filled' | 'outline', string> = {
    default: 'border border-gray-300 bg-white focus:border-primary-500 focus:ring-primary-500',
    filled: 'border-0 bg-gray-100 focus:bg-white focus:ring-primary-500',
    outline: 'border-2 border-gray-200 bg-transparent focus:border-primary-500'
  }

  const inputClasses = cn(
    // Base styles
    'block rounded-md shadow-sm transition-colors duration-200',
    'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-0',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50',
    
    // Size variants
    sizeClasses[inputSize],
    
    // Color variants
    variantClasses[variant],
    
    // Width
    fullWidth ? 'w-full' : '',
    
    // Error state
    error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : '',
    
    // Icon padding
    leftIcon ? 'pl-10' : '',
    (rightIcon || (isPassword && showPasswordToggle)) ? 'pr-10' : '',
    
    className
  )

  const labelClasses = cn(
    'block text-sm font-medium mb-1 transition-colors duration-200',
    error ? 'text-red-700' : 'text-gray-700',
    required && "after:content-['*'] after:ml-0.5 after:text-red-500"
  )

  return (
    <div className={cn('relative', fullWidth ? 'w-full' : '')}>
      {label && (
        <label htmlFor={props.id} className={labelClasses}>
          {label}
        </label>
      )}
      
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            {leftIcon}
          </div>
        )}
        
        <input
          ref={ref}
          type={inputType}
          className={inputClasses}
          disabled={disabled}
          required={required}
          onFocus={(e) => {
            setIsFocused(true)
            props.onFocus?.(e)
          }}
          onBlur={(e) => {
            setIsFocused(false)
            props.onBlur?.(e)
          }}
          {...props}
        />
        
        {(rightIcon || (isPassword && showPasswordToggle)) && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isPassword && showPasswordToggle ? (
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 focus:outline-none"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5" />
                ) : (
                  <EyeIcon className="h-5 w-5" />
                )}
              </button>
            ) : (
              rightIcon
            )}
          </div>
        )}
      </div>
      
      {(error || helperText) && (
        <p className={cn(
          'mt-1 text-xs',
          error ? 'text-red-600' : 'text-gray-500'
        )}>
          {error || helperText}
        </p>
      )}
    </div>
  )
})

Input.displayName = 'Input'

export default Input
