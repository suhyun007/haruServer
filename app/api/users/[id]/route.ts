import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: user, error } = await supabase
      .from('haru_users')
      .select(`
        *,
        dietMethod:haru_diet_methods(*)
      `)
      .eq('id', params.id)
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
      profileImageUrl: user.profile_image_url,
      dietMethod: user.dietMethod,
    }

    return NextResponse.json(formattedUser)
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      dailyCalorieGoal,
      dietStartDate,
      deviceId 
    } = body

    const updateData: any = {}
    if (nickname !== undefined) updateData.nickname = nickname
    if (age !== undefined) updateData.age = parseInt(age)
    if (gender !== undefined) updateData.gender = gender
    if (height !== undefined) updateData.height = parseFloat(height)
    if (heightUnit !== undefined) updateData.height_unit = heightUnit
    if (currentWeight !== undefined) updateData.current_weight = parseFloat(currentWeight)
    if (currentWeightUnit !== undefined) updateData.current_weight_unit = currentWeightUnit
    if (targetWeight !== undefined) updateData.target_weight = parseFloat(targetWeight)
    if (targetWeightUnit !== undefined) updateData.target_weight_unit = targetWeightUnit
    if (dietMethodId !== undefined) updateData.diet_method_id = dietMethodId
    if (dailyCalorieGoal !== undefined) updateData.daily_calorie_goal = parseInt(dailyCalorieGoal)
    if (dietStartDate !== undefined) updateData.diet_start_date = dietStartDate
    if (deviceId !== undefined) updateData.device_id = deviceId
    
    // 항상 last_login_at 업데이트
    updateData.last_login_at = new Date().toISOString()

    const { data: user, error } = await supabase
      .from('haru_users')
      .update(updateData)
      .eq('id', params.id)
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
      dietStartDate: user.diet_start_date,
      profileImageUrl: user.profile_image_url,
      dietMethod: user.dietMethod,
    }

    return NextResponse.json(formattedUser)
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 먼저 관련된 체중 기록 삭제
    const { error: weightError } = await supabase
      .from('haru_weight_records')
      .delete()
      .eq('user_id', params.id)

    if (weightError) {
      console.error('Error deleting weight records:', weightError)
    }

    // 사용자 삭제
    const { error } = await supabase
      .from('haru_users')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
