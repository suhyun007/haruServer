import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const date = searchParams.get('date')

    console.log('🔍 GET /api/weights - 파라미터:')
    console.log('   - userId:', userId)
    console.log('   - date:', date)

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    let query = supabase
      .from('haru_weight_records')
      .select('*')
      .eq('user_id', userId)

    // 날짜 필터링이 있으면 적용
    if (date) {
      console.log('📅 날짜 필터링 적용:', date)
      query = query.eq('date', date)
    } else {
      console.log('📅 날짜 필터링 없음 - 모든 기록 조회')
    }

    const { data: weights, error } = await query.order('date', { ascending: false })

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

    const normalisedDate = new Date(date).toISOString().split('T')[0]

    // 먼저 같은 날짜의 기존 기록이 있는지 확인
    const { data: existingRecord, error: existingError } = await supabase
      .from('haru_weight_records')
      .select('*')
      .eq('user_id', userId)
      .eq('date', normalisedDate)
      .maybeSingle()

    if (existingError && existingError.code !== 'PGRST116') throw existingError

    let weightRecord
    if (existingRecord) {
      // 기존 기록이 있으면 업데이트
      const { data, error } = await supabase
        .from('haru_weight_records')
        .update({
          weight: parseFloat(weight),
          weight_unit: weightUnit,
          date: normalisedDate,
          memo,
        })
        .eq('id', existingRecord.id)
        .select()
        .single()

      if (error) throw error
      weightRecord = data
    } else {
      const { data, error } = await supabase
        .from('haru_weight_records')
        .insert({
          user_id: userId,
          weight: parseFloat(weight),
          weight_unit: weightUnit,
          date: normalisedDate,
          memo,
        })
        .select()
        .single()

      if (error) throw error
      weightRecord = data
    }


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

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')

    console.log('🗑️ DELETE /api/weights - userId:', userId)

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // 해당 사용자의 모든 체중 기록 삭제
    const { error } = await supabase
      .from('haru_weight_records')
      .delete()
      .eq('user_id', userId)

    if (error) throw error

    console.log('✅ 체중 기록 삭제 완료 - userId:', userId)
    return NextResponse.json({ message: 'Weight records deleted successfully' })
  } catch (error) {
    console.error('Error deleting weight records:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
