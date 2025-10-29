import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const date = searchParams.get('date');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    console.log('🔍 GET /api/diary - 파라미터:', {
      userId,
      date: date || 'null'
    });

    let query = supabase
      .from('haru_diary')
      .select('*')
      .eq('user_id', userId);

    // 날짜가 제공된 경우 해당 날짜로 필터링
    if (date) {
      query = query.eq('date', date);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('다이어리 조회 오류:', error);
      return NextResponse.json(
        { error: 'Failed to fetch diary entries', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ 다이어리 조회 성공:', data?.length || 0, '개');

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('다이어리 조회 오류:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, date, note, mood } = body;

    if (!userId || !date) {
      return NextResponse.json(
        { error: 'userId and date are required' },
        { status: 400 }
      );
    }

    console.log('📝 POST /api/diary - 다이어리 생성:', {
      userId,
      date,
      note: note ? `${note.substring(0, 20)}...` : 'null',
      mood: mood || 'null'
    });

    // 기존 다이어리가 있는지 확인
    const { data: existingDiary, error: checkError } = await supabase
      .from('haru_diary')
      .select('id')
      .eq('user_id', userId)
      .eq('date', date)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('기존 다이어리 확인 오류:', checkError);
      return NextResponse.json(
        { error: 'Failed to check existing diary', details: checkError.message },
        { status: 500 }
      );
    }

    let result;
    if (existingDiary) {
      // 기존 다이어리 업데이트
      const { data, error } = await supabase
        .from('haru_diary')
        .update({
          note: note || null,
          mood: mood || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingDiary.id)
        .select()
        .single();

      if (error) {
        console.error('다이어리 업데이트 오류:', error);
        return NextResponse.json(
          { error: 'Failed to update diary', details: error.message },
          { status: 500 }
        );
      }

      result = data;
      console.log('✅ 다이어리 업데이트 성공');
    } else {
      // 새 다이어리 생성
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('haru_diary')
        .insert({
          user_id: userId,
          date: date,
          note: note || null,
          mood: mood || null,
          created_at: now,
          updated_at: now
        })
        .select()
        .single();

      if (error) {
        console.error('다이어리 생성 오류:', error);
        return NextResponse.json(
          { error: 'Failed to create diary', details: error.message },
          { status: 500 }
        );
      }

      result = data;
      console.log('✅ 다이어리 생성 성공');
    }

    return NextResponse.json({
      success: true,
      diary: result,
      message: existingDiary ? 'Diary updated successfully' : 'Diary created successfully'
    });
  } catch (error: any) {
    console.error('다이어리 처리 오류:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, mood, note, tags } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    console.log('📝 PUT /api/diary - 다이어리 수정:', {
      id,
      mood: mood || 'null',
      note: note ? `${note.substring(0, 20)}...` : 'null',
      tags: tags || []
    });

    // 다이어리 업데이트
    const { data, error } = await supabase
      .from('haru_diary')
      .update({
        mood: mood || null,
        note: note || null,
        tags: tags || [],
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('다이어리 업데이트 오류:', error);
      return NextResponse.json(
        { error: 'Failed to update diary', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ 다이어리 업데이트 성공');

    return NextResponse.json({
      success: true,
      diary: data,
      message: 'Diary updated successfully'
    });
  } catch (error: any) {
    console.error('다이어리 수정 오류:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}