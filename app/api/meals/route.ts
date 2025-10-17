import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const date = searchParams.get('date')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const where: any = { userId }

    if (date) {
      const startDate = new Date(date)
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(date)
      endDate.setHours(23, 59, 59, 999)

      where.date = {
        gte: startDate,
        lte: endDate,
      }
    }

    const meals = await prisma.meal.findMany({
      where,
      orderBy: { date: 'desc' },
    })

    return NextResponse.json(meals)
  } catch (error) {
    console.error('Error fetching meals:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, mealType, foodName, calories, date } = body

    const meal = await prisma.meal.create({
      data: {
        userId,
        mealType,
        foodName,
        calories: parseInt(calories),
        date: new Date(date),
      },
    })

    return NextResponse.json(meal, { status: 201 })
  } catch (error) {
    console.error('Error creating meal:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

