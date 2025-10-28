import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // last_login_at만 업데이트
    const { data: user, error } = await supabase
      .from('haru_users')
      .update({
        last_login_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select(`
        *,
        dietMethod:haru_diet_methods(*)
      `)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      throw error
    }

    // Convert snake_case to camelCase
    const formattedUser = {
      id: user.id,
      nickname: user.nickname,
      age: user.age,
      gender: user.gender,
      height: user.height,
      heightUnit: user.height_unit,
      currentWeight: user.current_weight,
      currentWeightUnit: user.current_weight_unit,
      targetWeight: user.target_weight,
      targetWeightUnit: user.target_weight_unit,
      dailyCalorieGoal: user.daily_calorie_goal,
      dietStartDate: user.diet_start_date,
      dietMethod: user.dietMethod,
    }

    return NextResponse.json(formattedUser)
  } catch (error) {
    console.error('Error updating last login:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
