import NextAuth from '@/lib/auth'

// In NextAuth v4, we directly export the default NextAuth instance
// The handlers are automatically available as GET and POST methods
const handler = NextAuth

export { handler as GET, handler as POST }
