import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { deviceId: string } }
) {
  try {
    const { deviceId } = params

    if (!deviceId) {
      return NextResponse.json({ error: 'deviceId is required' }, { status: 400 })
    }

    const { data: user, error } = await supabase
      .from('haru_users')
      .select(`
        *,
        dietMethod:haru_diet_methods(*)
      `)
      .eq('device_id', deviceId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return NextResponse.json(null)
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
      deviceId: user.device_id,
    }

    return NextResponse.json(formattedUser)
  } catch (error) {
    console.error('Error fetching user by device ID:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
