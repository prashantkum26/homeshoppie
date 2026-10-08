import NextAuth, {
  type DefaultSession,
  type NextAuthOptions,
} from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { getServerSession } from 'next-auth/next'
import { signIn, signOut } from 'next-auth/react'
import bcrypt from 'bcryptjs'

import { prisma } from './prisma'

// ============================================================
// NextAuth Type Extensions
// ============================================================

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

declare module 'next-auth/jwt' {
  interface JWT {
    role: string
    emailVerified: boolean
    phoneVerified: boolean
    phone: string | null
  }
}

// ============================================================
// NextAuth Configuration
// ============================================================

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',

      credentials: {
        email: {
          label: 'Email',
          type: 'email',
        },

        password: {
          label: 'Password',
          type: 'password',
        },
      },

      async authorize(credentials) {
        // ----------------------------------------------------
        // Basic input validation
        // ----------------------------------------------------

        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = String(credentials.email)
          .trim()
          .toLowerCase()

        const password = String(credentials.password)

        if (!email || !password) {
          return null
        }

        // ----------------------------------------------------
        // Find user
        // ----------------------------------------------------

        const user = await prisma.user.findUnique({
          where: {
            email,
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

            emailVerified: true,

            phone: true,
            phoneVerified: true,
          },
        })

        // ----------------------------------------------------
        // User does not exist
        // ----------------------------------------------------

        if (!user || !user.passwordHash) {
          return null
        }

        // ----------------------------------------------------
        // Account disabled
        // ----------------------------------------------------

        if (!user.isActive) {
          return null
        }

        // ----------------------------------------------------
        // Account locked
        //
        // If isLocked = true:
        //
        // 1. No lockUntil = permanently locked
        // 2. Future lockUntil = temporarily locked
        // 3. Past lockUntil = lock expired
        // ----------------------------------------------------

        if (user.isLocked) {
          if (!user.lockUntil || user.lockUntil > new Date()) {
            return null
          }

          // Lock expired.
          //
          // The login can continue.
          // Your login security service should ideally
          // clear isLocked/lockUntil after successful login.
        }

        // ----------------------------------------------------
        // Password verification
        // ----------------------------------------------------

        let passwordToVerify = password

        // New password format:
        //
        // password + explicit passwordSalt
        //
        if (user.passwordSalt) {
          passwordToVerify = password + user.passwordSalt
        }

        const isPasswordValid = await bcrypt.compare(
          passwordToVerify,
          user.passwordHash
        )

        if (!isPasswordValid) {
          return null
        }

        // ----------------------------------------------------
        // Successful authentication
        // ----------------------------------------------------

        return {
          id: user.id,
          email: user.email,
          name: user.name,

          role: user.role,

          emailVerified: Boolean(user.emailVerified),

          phoneVerified: Boolean(user.phoneVerified),

          phone: user.phone,
        }
      },
    }),
  ],

  // ==========================================================
  // JWT Session
  // ==========================================================

  session: {
    strategy: 'jwt',
  },

  // ==========================================================
  // Callbacks
  // ==========================================================

  callbacks: {
    async jwt({ token, user, trigger }) {
      // Initial sign-in
      if (user) {
        token.sub = user.id
        token.email = user.email
        token.name = user.name
        token.role = user.role

        token.emailVerified = Boolean(user.emailVerified)
        token.phoneVerified = Boolean(user.phoneVerified)
        token.phone = user.phone
      }

      // Session update requested from client
      if (trigger === 'update' && token.sub) {
        const currentUser = await prisma.user.findUnique({
          where: {
            id: token.sub,
          },
          select: {
            email: true,
            name: true,
            role: true,
            emailVerified: true,
            phoneVerified: true,
            phone: true,
            isActive: true,
          },
        })

        if (!currentUser || !currentUser.isActive) {
          return token
        }

        token.email = currentUser.email
        token.name = currentUser.name
        token.role = currentUser.role

        token.emailVerified = Boolean(
          currentUser.emailVerified
        )

        token.phoneVerified = Boolean(
          currentUser.phoneVerified
        )

        token.phone = currentUser.phone
      }

      return token
    },

    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub
      }

      if (token.email) {
        session.user.email = token.email
      }

      session.user.name = token.name ?? null
      session.user.role = token.role

      session.user.emailVerified = Boolean(
        token.emailVerified
      )

      session.user.phoneVerified = Boolean(
        token.phoneVerified
      )

      session.user.phone = token.phone ?? null

      return session
    },
  },

  // ==========================================================
  // Custom Pages
  // ==========================================================

  pages: {
    signIn: '/auth/signin'
  },
}

// ============================================================
// NextAuth API Handler
// ============================================================

export default NextAuth(authOptions)

// ============================================================
// Server-side Auth
//
// IMPORTANT:
//
// The session/JWT identifies the user.
// The database is the source of truth.
//
// This means changes to:
//
// - isActive
// - role
// - emailVerified
// - phoneVerified
// - phone
//
// are reflected immediately.
//
// ============================================================

export async function auth() {
  const session = await getServerSession(authOptions)

  // ----------------------------------------------------------
  // No session
  // ----------------------------------------------------------

  if (!session?.user?.id) {
    return null
  }

  // ----------------------------------------------------------
  // Get CURRENT user from database
  // ----------------------------------------------------------

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },

    select: {
      id: true,
      email: true,
      name: true,
      role: true,

      isActive: true,

      emailVerified: true,

      phone: true,
      phoneVerified: true,
    },
  })

  // ----------------------------------------------------------
  // User deleted
  // ----------------------------------------------------------

  if (!user) {
    return null
  }

  // ----------------------------------------------------------
  // User disabled
  // ----------------------------------------------------------

  if (!user.isActive) {
    return null
  }

  // ----------------------------------------------------------
  // Return DB-backed current user
  //
  // Do NOT trust potentially stale JWT values for
  // security-sensitive information.
  // ----------------------------------------------------------

  return {
    user: {
      id: user.id,

      email: user.email,

      name: user.name,

      role: user.role,

      emailVerified: Boolean(
        user.emailVerified
      ),

      phone: user.phone,

      phoneVerified: Boolean(
        user.phoneVerified
      ),
    },
  }
}

// ============================================================
// Get Current User
//
// Useful when you only need the database user object.
// ============================================================

export async function getCurrentUser() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },

    select: {
      id: true,
      email: true,
      name: true,
      role: true,

      isActive: true,

      emailVerified: true,

      phone: true,
      phoneVerified: true,
    },
  })

  if (!user?.isActive) {
    return null
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,

    emailVerified: Boolean(
      user.emailVerified
    ),

    phone: user.phone,

    phoneVerified: Boolean(
      user.phoneVerified
    ),
  }
}

// ============================================================
// Required Contact Verification
//
// Rules:
//
// 1. Account must be active
// 2. Email must be verified
// 3. If phone exists, phone must be verified
//
// Example:
//
// emailVerified = true
// phone = null
// => true
//
// emailVerified = true
// phone = "+919999999999"
// phoneVerified = true
// => true
//
// emailVerified = true
// phone = "+919999999999"
// phoneVerified = false
// => false
// ============================================================

export async function hasVerifiedContact(
  userId: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },

    select: {
      isActive: true,

      emailVerified: true,

      phone: true,
      phoneVerified: true,
    },
  })

  // ----------------------------------------------------------
  // User missing / inactive
  // ----------------------------------------------------------

  if (!user?.isActive) {
    return false
  }

  // ----------------------------------------------------------
  // Email must always be verified
  // ----------------------------------------------------------

  if (!user.emailVerified) {
    return false
  }

  // ----------------------------------------------------------
  // Phone is optional.
  //
  // If phone exists, it MUST be verified.
  // ----------------------------------------------------------

  if (
    user.phone &&
    !user.phoneVerified
  ) {
    return false
  }

  return true
}

// ============================================================
// Require Authenticated User
//
// Throws if the user is not authenticated.
//
// Useful for server actions / protected server logic.
//
// ============================================================

export async function requireAuth() {
  const session = await auth()

  if (!session) {
    throw new Error('Unauthorized')
  }

  return session
}

// ============================================================
// Require Specific Role
//
// Example:
//
// const session = await requireRole('ADMIN')
//
// ============================================================

export async function requireRole(
  role: string
) {
  const session = await auth()

  if (!session) {
    throw new Error('Unauthorized')
  }

  if (session.user.role !== role) {
    throw new Error('Forbidden')
  }

  return session
}

// ============================================================
// Require Verified Contact
//
// Example:
//
// const session = await requireVerifiedContact()
//
// ============================================================

export async function requireVerifiedContact() {
  const session = await auth()

  if (!session) {
    throw new Error('Unauthorized')
  }

  const verified = await hasVerifiedContact(
    session.user.id
  )

  if (!verified) {
    throw new Error(
      'Email or phone verification required'
    )
  }

  return session
}

// ============================================================
// Client-side signIn / signOut
// ============================================================

export {
  signIn,
  signOut,
}
