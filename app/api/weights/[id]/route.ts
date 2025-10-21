import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { weight, date, memo } = body

    const { data: weightRecord, error } = await supabase
      .from('haru_weight_records')
      .update({
        weight: parseFloat(weight),
        date: new Date(date).toISOString(),
        memo: memo,
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    // Convert snake_case to camelCase
    const formattedWeightRecord = {
      id: weightRecord.id,
      userId: weightRecord.user_id,
      weight: weightRecord.weight,
      weightUnit: weightRecord.weight_unit,
      date: weightRecord.date,
      memo: weightRecord.memo,
      createdAt: weightRecord.created_at,
    }

    return NextResponse.json(formattedWeightRecord)
  } catch (error) {
    console.error('Error updating weight record:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
