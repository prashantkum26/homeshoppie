import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 })
    }

    const [activityLogsRaw, securityLogs] = await Promise.all([
      prisma.userActivityLog.findMany({
        take: 300,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.securityLog.findMany({
        take: 300,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true, role: true } }
        }
      })
    ])

    // 2. Extract unique user IDs safely (TypeScript ES5 compatible)
    const allIds = activityLogsRaw.map(log => log.userId).filter(Boolean) as string[]
    const userIds = allIds.filter((id, index) => allIds.indexOf(id) === index)

    // 3. Manually fetch the existing users
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, role: true }
    })

    // Create a lookup map for fast matching
    const userMap = new Map(users.map(u => [u.id, u]))

    // 4. Manually stitch the users into the activity logs
    const activityLogs = activityLogsRaw.map(log => ({
      ...log,
      user: userMap.get(log.userId) || { 
        name: 'Deleted User', 
        email: 'User no longer exists', 
        role: 'UNKNOWN' 
      }
    }))

    return NextResponse.json({
      activityLogs,
      securityLogs
    })
  } catch (error) {
    console.error('Error fetching security & audit logs:', error)
    return NextResponse.json(
      { error: 'Internal server error while fetching logs' },
      { status: 500 }
    )
  }
}