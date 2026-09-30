import NextAuth, { type DefaultSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string | null
      role: string
      emailVerified: boolean
      phoneVerified: boolean
      phone: string | null
    } & DefaultSession['user']
  }

  interface User {
    id: string
    email: string
    name: string | null
    role: string
    emailVerified: boolean
    phoneVerified: boolean
    phone: string | null
  }
}

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email as string
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            passwordHash: true,
            passwordSalt: true,
            isActive: true,
            isLocked: true,
            lockUntil: true,
            failedLoginCount: true,
            emailVerified: true,
            phone: true,
            phoneVerified: true
          }
        })

        if (!user || !user.passwordHash) {
          return null
        }

        // Check if account is active
        if (user.isActive === false) {
          return null
        }

        // Check if account is locked
        if (user.isLocked && user.lockUntil && user.lockUntil > new Date()) {
          return null
        }

        let isPasswordValid = false

        // Use explicit salt if available, otherwise fallback to bcrypt's built-in salt
        if (user.passwordSalt) {
          // New method: explicit salt
          const saltedPassword = (credentials.password as string) + user.passwordSalt
          isPasswordValid = await bcrypt.compare(saltedPassword, user.passwordHash)
        } else {
          // Backward compatibility: bcrypt's built-in salt
          isPasswordValid = await bcrypt.compare(credentials.password as string, user.passwordHash)
        }

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerified: !!user.emailVerified,
          phoneVerified: !!(user as any).phoneVerified, // Temporary fallback
          phone: user.phone,
        }
      }
    })
  ],
  session: {
    strategy: 'jwt' as const
  },
  callbacks: {
    async jwt({ token, user }: { token: any; user: any }) {
      if (user) {
        token.role = user.role
        token.emailVerified = user.emailVerified
        token.phoneVerified = user.phoneVerified
        token.phone = user.phone
      }
      return token
    },
    async session({ session, token }: { session: any; token: any }) {
      if (token.sub) {
        session.user.id = token.sub
        session.user.role = token.role
        session.user.emailVerified = token.emailVerified
        session.user.phoneVerified = token.phoneVerified
        session.user.phone = token.phone
      }
      return session
    }
  },
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
  }
}

// NextAuth v4 approach
export default NextAuth(authOptions)

// For server-side session access in NextAuth v4, we use getServerSession
import { getServerSession } from 'next-auth/next'

export async function auth() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      isActive: true,
      role: true,
      emailVerified: true,
      phone: true,
      phoneVerified: true,
    },
  })

  if (
    !currentUser?.isActive
  ) {
    return null
  }

  session.user.role = currentUser.role
  session.user.emailVerified = Boolean(currentUser.emailVerified)
  session.user.phone = currentUser.phone
  session.user.phoneVerified = Boolean(currentUser.phoneVerified)
  return session
}

export async function hasVerifiedContact(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isActive: true,
      emailVerified: true,
      phone: true,
      phoneVerified: true,
    },
  })

  return Boolean(
    user?.isActive &&
    user.emailVerified &&
    (!user.phone || user.phoneVerified)
  )
}

// Export signIn and signOut from next-auth/react (they're imported differently in v4)
export { signIn, signOut } from 'next-auth/react'
