import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.meal.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: 'Meal deleted successfully' })
  } catch (error) {
    console.error('Error deleting meal:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

