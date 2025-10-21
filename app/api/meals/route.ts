import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const date = searchParams.get('date')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    let query = supabase
      .from('meal_records')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })

    if (date) {
      const startDate = new Date(date)
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(date)
      endDate.setHours(23, 59, 59, 999)

      query = query
        .gte('date', startDate.toISOString())
        .lte('date', endDate.toISOString())
    }

    const { data: meals, error } = await query

    if (error) throw error

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

    const { data: meal, error } = await supabase
      .from('meal_records')
      .insert({
        user_id: userId,
        meal_type: mealType,
        food_name: foodName,
        calories: parseInt(calories),
        date: new Date(date).toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(meal, { status: 201 })
  } catch (error) {
    console.error('Error creating meal:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
