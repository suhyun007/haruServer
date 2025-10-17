import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const weights = await prisma.weight.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
    })

    return NextResponse.json(weights)
  } catch (error) {
    console.error('Error fetching weights:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, weight, date } = body

    const weightRecord = await prisma.weight.create({
      data: {
        userId,
        weight: parseFloat(weight),
        date: new Date(date),
      },
    })

    // Update user's current weight
    await prisma.user.update({
      where: { id: userId },
      data: { currentWeight: parseFloat(weight) },
    })

    return NextResponse.json(weightRecord, { status: 201 })
  } catch (error) {
    console.error('Error creating weight record:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

