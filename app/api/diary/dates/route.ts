import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Next 권장 설정: 동적 라우트로 강제, 캐시 비활성화 
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // 사용자의 다이어리가 있는 날짜만 조회
    const { data, error } = await supabase
      .from('haru_diary')
      .select('date')
      .eq('user_id', userId);

    if (error) throw error;

    // 중복 제거하여 유니크한 날짜 리스트 반환
    const dates = data?.map(item => item.date) || [];
    const uniqueDates = Array.from(new Set(dates));

    return NextResponse.json(uniqueDates);
  } catch (error: any) {
    console.error('Error fetching diary dates:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

