import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { socialId: string } }
) {
  try {
    const socialId = params.socialId
    console.log('🗑️ DELETE /api/users/social/[socialId] - socialId:', socialId)

    // 1. 먼저 해당 사용자의 ID 조회
    const { data: user, error: userError } = await supabase
      .from('haru_users')
      .select('id')
      .eq('social_id', socialId)
      .single()

    if (userError) {
      console.error('사용자 조회 실패:', userError)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userId = user.id
    console.log('📱 조회된 사용자 ID:', userId)

    // 2. 체중 기록 삭제
    const { error: weightError } = await supabase
      .from('haru_weight_records')
      .delete()
      .eq('user_id', userId)

    if (weightError) {
      console.error('체중 기록 삭제 실패:', weightError)
      return NextResponse.json({ error: 'Failed to delete weight records' }, { status: 500 })
    }

    console.log('✅ 체중 기록 삭제 완료')

    // 3. 사용자 삭제
    const { error: deleteError } = await supabase
      .from('haru_users')
      .delete()
      .eq('social_id', socialId)

    if (deleteError) {
      console.error('사용자 삭제 실패:', deleteError)
      return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
    }

    console.log('✅ 소셜 사용자 삭제 완료 - socialId:', socialId)
    return NextResponse.json({ message: 'User deleted successfully' })
  } catch (error) {
    console.error('Error deleting user by social ID:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
