import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const { data: weights, error } = await supabase
      .from('haru_weight_records')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: true })

    if (error) throw error

    return NextResponse.json(weights)
  } catch (error) {
    console.error('Error fetching weights:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, weight, weightUnit, date, memo } = body

    const { data: weightRecord, error: weightError } = await supabase
      .from('haru_weight_records')
      .insert({
        user_id: userId,
        weight: parseFloat(weight),
        weight_unit: weightUnit,
        date: new Date(date).toISOString(),
        memo,
      })
      .select()
      .single()

    if (weightError) throw weightError

    // Update user's current weight
    const { error: userError } = await supabase
      .from('haru_users')
      .update({ 
        current_weight: parseFloat(weight),
        current_weight_unit: weightUnit
      })
      .eq('id', userId)

    if (userError) throw userError

    return NextResponse.json(weightRecord, { status: 201 })
  } catch (error) {
    console.error('Error creating weight record:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
