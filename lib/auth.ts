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
    } & DefaultSession['user']
  }

  interface User {
    id: string
    email: string
    name: string | null
    role: string
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
            failedLoginCount: true
          }
        })

        if (!user || !user.passwordHash) {
          return null
        }

        // Check if account is active
        if (user.isActive === false) {
          console.log('Account is inactive:', credentials.email)
          return null
        }

        // Check if account is locked
        if (user.isLocked && user.lockUntil && user.lockUntil > new Date()) {
          console.log('Account is locked until:', user.lockUntil)
          return null
        }

        let isPasswordValid = false

        // Use explicit salt if available, otherwise fallback to bcrypt's built-in salt
        if (user.passwordSalt) {
          // New method: explicit salt
          const saltedPassword = (credentials.password as string) + user.passwordSalt
          isPasswordValid = await bcrypt.compare(saltedPassword, user.passwordHash)
          console.log('Using explicit salt for authentication:', credentials.email)
        } else {
          // Backward compatibility: bcrypt's built-in salt
          isPasswordValid = await bcrypt.compare(credentials.password as string, user.passwordHash)
          console.log('Using bcrypt built-in salt (legacy):', credentials.email)
        }

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
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
      }
      return token
    },
    async session({ session, token }: { session: any; token: any }) {
      if (token.sub) {
        session.user.id = token.sub
        session.user.role = token.role
      }
      return session
    }
  },
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
  }
}

const { handlers, auth, signIn, signOut } = NextAuth(authOptions)

export { handlers, auth, signIn, signOut }
