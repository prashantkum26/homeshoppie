import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const data = await request.json()
    const { name, slug, description, parentId, sortOrder, isActive, isVisible } = data

    // Check for duplicate slug if slug is changing
    if (slug) {
      const existing = await prisma.category.findFirst({
        where: { slug, id: { not: id } }
      })
      if (existing) {
        return NextResponse.json({ error: 'Slug is already in use.' }, { status: 400 })
      }
    }

    const updated = await prisma.category.update({
      where: { id },
      data: {
        name,
        slug,
        description,
        parentId,
        sortOrder,
        isActive,
        isVisible,
        updatedBy: session.user.id
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify it doesn't have active children
    const childCount = await prisma.category.count({ where: { parentId: id, deletedAt: null } })
    if (childCount > 0) {
      return NextResponse.json({ error: 'Cannot delete category with sub-categories' }, { status: 400 })
    }

    // Soft delete (setting deletedAt)
    await prisma.category.update({
      where: { id },
      data: { 
        deletedAt: new Date(),
        deletedBy: session.user.id,
        isActive: false, // Ensure it hides from store
        isVisible: false
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}