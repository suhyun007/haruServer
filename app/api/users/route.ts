import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: users, error } = await supabase
      .from('haru_users')
      .select(`
        *,
        dietMethod:haru_diet_methods(*)
      `)

    if (error) throw error

    // Convert snake_case to camelCase
    const formattedUsers = users?.map(user => ({
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
    }))

    return NextResponse.json(formattedUsers)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      nickname, 
      age, 
      gender, 
      height, 
      heightUnit, 
      currentWeight, 
      currentWeightUnit, 
      targetWeight, 
      targetWeightUnit, 
      dietMethodId, 
      dietStartDate, 
      dailyCalorieGoal 
    } = body

    const { data: user, error } = await supabase
      .from('haru_users')
      .insert({
        nickname,
        age: parseInt(age),
        gender,
        height: parseFloat(height),
        height_unit: heightUnit,
        current_weight: parseFloat(currentWeight),
        current_weight_unit: currentWeightUnit,
        target_weight: parseFloat(targetWeight),
        target_weight_unit: targetWeightUnit,
        diet_method_id: dietMethodId,
        diet_start_date: dietStartDate,
        daily_calorie_goal: parseInt(dailyCalorieGoal),
      })
      .select(`
        *,
        dietMethod:haru_diet_methods(*)
      `)
      .single()

    if (error) throw error

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
      dietMethod: user.dietMethod,
    }

    return NextResponse.json(formattedUser, { status: 201 })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
