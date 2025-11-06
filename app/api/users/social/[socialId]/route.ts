import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { socialId: string } }
) {
  try {
    const socialId = params.socialId
    console.log('🔍 GET /api/users/social/[socialId] - socialId:', socialId)

    const { data: user, error } = await supabase
      .from('haru_users')
      .select(`
        *,
        dietMethod:haru_diet_methods(*)
      `)
      .eq('social_id', socialId)
      .single()

    if (error) {
      console.error('사용자 조회 실패:', error)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    console.log('✅ 사용자 조회 성공:', user.id)
    return NextResponse.json(user)
  } catch (error) {
    console.error('Error fetching user by social ID:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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

    // 2. 프로필 이미지 삭제 (Storage에서)
    // profiles 폴더의 모든 파일을 가져와서 해당 사용자 ID가 포함된 파일 찾기
    const { data: files, error: listError } = await supabase.storage
      .from('harufit-images')
      .list('profiles')

    if (!listError && files && files.length > 0) {
      // 사용자 ID가 포함된 모든 파일 찾기
      const userImageFiles = files.filter(file => 
        file.name.includes(`profile_${userId}`) || 
        file.name.startsWith(`profile_${userId}.`)
      )
      
      if (userImageFiles.length > 0) {
        const filePaths = userImageFiles.map(file => `profiles/${file.name}`)
        console.log('🗑️ 삭제할 프로필 이미지 파일들:', filePaths)
        
        const { error: imageDeleteError } = await supabase.storage
          .from('harufit-images')
          .remove(filePaths)

        if (imageDeleteError) {
          console.error('프로필 이미지 삭제 실패:', imageDeleteError)
          // 에러가 발생해도 계속 진행
        } else {
          console.log('✅ 프로필 이미지 삭제 완료:', filePaths)
        }
      } else {
        console.log('⚠️ 해당 사용자의 프로필 이미지 파일을 찾을 수 없음')
      }
    }
    
    // 추가로 정확한 경로로도 삭제 시도 (혹시 모를 경우를 대비)
    const imageFileName = `profile_${userId}.jpg`
    const imageFilePath = `profiles/${imageFileName}`
    
    const { error: directDeleteError } = await supabase.storage
      .from('harufit-images')
      .remove([imageFilePath])

    if (directDeleteError) {
      console.log('⚠️ 직접 경로 삭제 실패 (파일 없음 또는 이미 삭제됨):', directDeleteError.message)
    } else {
      console.log('✅ 직접 경로로 프로필 이미지 삭제 완료:', imageFilePath)
    }

    // 3. 체중 기록 삭제
    const { error: weightError } = await supabase
      .from('haru_weight_records')
      .delete()
      .eq('user_id', userId)

    if (weightError) {
      console.error('체중 기록 삭제 실패:', weightError)
      return NextResponse.json({ error: 'Failed to delete weight records' }, { status: 500 })
    }

    console.log('✅ 체중 기록 삭제 완료')

    // 4. 관련된 다이어리 삭제 (CASCADE가 있지만 명시적으로 삭제)
    const { error: diaryError } = await supabase
      .from('haru_diary')
      .delete()
      .eq('user_id', userId)

    if (diaryError) {
      console.error('다이어리 삭제 실패:', diaryError)
      return NextResponse.json({ error: 'Failed to delete diary records' }, { status: 500 })
    }
    console.log('✅ 다이어리 삭제 완료')

    // 5. 사용자 삭제 (haru_users 테이블에서 삭제)
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
