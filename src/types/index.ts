// Base types
export interface User {
  id: string
  email: string
  name: string | null
  image: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  image: string | null
  createdAt: Date
  updatedAt: Date
  products?: Product[]
}

export interface Product {
  id: string
  name: string
  slug: string
  description: string | null
  price: number
  originalPrice: number | null
  stock: number
  sku: string | null
  images: string[]
  categoryId: string
  category?: Category
  featured: boolean
  createdAt: Date
  updatedAt: Date
}

export interface CartItem {
  id: string
  productId: string
  quantity: number
  product: Product
}

export interface Cart {
  items: CartItem[]
  totalItems: number
  totalPrice: number
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Form types
export interface ProductCreateInput {
  name: string
  description?: string
  price: number
  originalPrice?: number
  stock: number
  sku?: string
  images: string[]
  categoryId: string
  featured?: boolean
}

export interface CategoryCreateInput {
  name: string
  description?: string
  image?: string
}

// Auth types
export interface AuthUser {
  id: string
  email: string
  name: string | null
  image: string | null
}

export interface SessionUser extends AuthUser {
  accessToken?: string
}

// Store types
export interface CartStore {
  items: CartItem[]
  addItem: (product: Product, quantity?: number) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  getTotalItems: () => number
  getTotalPrice: () => number
}

// Component prop types
export interface ProductCardProps {
  product: Product
  showAddToCart?: boolean
}

export interface CategoryCardProps {
  category: Category
}

export interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

// Next.js specific types
export interface PageProps<T = {}> {
  params: T
  searchParams: { [key: string]: string | string[] | undefined }
}

export interface ProductPageParams {
  id: string
}

export interface CategoryPageParams {
  slug: string
}

// Error types
export class AppError extends Error {
  statusCode: number
  
  constructor(message: string, statusCode: number = 500) {
    super(message)
    this.statusCode = statusCode
    this.name = 'AppError'
  }
}

// Database types
export interface DatabaseConfig {
  url: string
  maxConnections?: number
  ssl?: boolean
}

// Environment types
export interface Environment {
  DATABASE_URL: string
  NEXTAUTH_URL: string
  NEXTAUTH_SECRET: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
}
