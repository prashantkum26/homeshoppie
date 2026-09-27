import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH update user (role, active status, lock status)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    // 1. Allow both ADMIN and SUPER_ADMIN
    if (!session?.user?.id || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: userId } = await params
    const body = await request.json()
    
    // 2. Extract all fields the new UI might send
    const { role, isActive, isLocked } = body

    // 3. Validate extended roles
    if (role && !['USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role provided' },
        { status: 400 }
      )
    }

    // 4. Prevent dangerous self-modifications
    if (userId === session.user.id) {
      if (role && role !== session.user.role) {
        return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 })
      }
      if (isActive === false) {
        return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 })
      }
      if (isLocked === true) {
        return NextResponse.json({ error: 'Cannot lock your own account' }, { status: 400 })
      }
    }

    // 5. Build dynamic update object (only update what was sent)
    const updateData: any = {}
    if (role !== undefined) updateData.role = role
    if (isActive !== undefined) updateData.isActive = isActive
    
    if (isLocked !== undefined) {
      updateData.isLocked = isLocked
      // 6. Automatically reset failed attempts when unlocking
      if (isLocked === false) {
        updateData.failedLoginCount = 0
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        isLocked: true,
        failedLoginCount: true,
        updatedAt: true,
      }
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}