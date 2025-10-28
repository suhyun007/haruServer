import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 알림 스케줄 저장소 (실제로는 데이터베이스에 저장)
const notificationSchedules = new Map<string, {
  userId: string;
  time: string;
  type: string;
  isActive: boolean;
}>();

export async function POST(request: NextRequest) {
  try {
    const { time, userId, type } = await request.json();
    
    console.log('📅 알림 스케줄 요청:', { time, userId, type });
    
    // 유효성 검사
    if (!time || !userId || !type) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      );
    }
    
    // 시간 형식 검증 (HH:mm)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(time)) {
      return NextResponse.json(
        { error: '시간 형식이 올바르지 않습니다. (HH:mm)' },
        { status: 400 }
      );
    }
    
    // 기존 스케줄 취소
    if (notificationSchedules.has(userId)) {
      console.log('🔄 기존 알림 스케줄 취소:', userId);
    }
    
    // 새 스케줄 저장
    notificationSchedules.set(userId, {
      userId,
      time,
      type,
      isActive: true
    });
    
    console.log('✅ 알림 스케줄 저장 완료:', { userId, time, type });
    
    // 스케줄러 시작 (실제로는 cron job이나 스케줄러 사용)
    startNotificationScheduler();
    
    return NextResponse.json({
      success: true,
      message: `매일 ${time}에 알림이 전송됩니다.`,
      scheduleId: userId
    });
    
  } catch (error) {
    console.error('❌ 알림 스케줄 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 알림 스케줄러 시작
function startNotificationScheduler() {
  console.log('🚀 알림 스케줄러 시작');
  
  // 매분마다 체크
  setInterval(() => {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    console.log('⏰ 현재 시간:', currentTime);
    
    // 모든 스케줄 확인
    for (const [userId, schedule] of notificationSchedules.entries()) {
      if (schedule.isActive && schedule.time === currentTime) {
        console.log('🔔 알림 전송:', { userId, time: schedule.time });
        sendNotificationToUser(userId, schedule.type);
      }
    }
  }, 60000); // 1분마다 체크
}

// 사용자에게 알림 전송
async function sendNotificationToUser(userId: string, type: string) {
  try {
    console.log('📤 알림 전송 시작:', { userId, type });
    
    // 실제로는 FCM, OneSignal, 또는 다른 푸시 서비스 사용
    // 여기서는 로그만 출력
    console.log('✅ 알림 전송 완료:', {
      userId,
      type,
      title: '⚖️ 체중 기록 시간!',
      body: '오늘의 체중을 기록하고 변화를 확인해보세요.',
      timestamp: new Date().toISOString()
    });
    
    // 알림 전송 후 스케줄 비활성화 (일일 알림이므로)
    const schedule = notificationSchedules.get(userId);
    if (schedule) {
      schedule.isActive = false;
      console.log('📅 알림 스케줄 비활성화:', userId);
    }
    
  } catch (error) {
    console.error('❌ 알림 전송 실패:', error);
  }
}

// 스케줄 조회 API
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId가 필요합니다.' },
        { status: 400 }
      );
    }
    
    const schedule = notificationSchedules.get(userId);
    
    if (!schedule) {
      return NextResponse.json(
        { error: '알림 스케줄을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      schedule: {
        userId: schedule.userId,
        time: schedule.time,
        type: schedule.type,
        isActive: schedule.isActive
      }
    });
    
  } catch (error) {
    console.error('❌ 스케줄 조회 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 스케줄 삭제 API
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId가 필요합니다.' },
        { status: 400 }
      );
    }
    
    const deleted = notificationSchedules.delete(userId);
    
    if (!deleted) {
      return NextResponse.json(
        { error: '알림 스케줄을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    console.log('🗑️ 알림 스케줄 삭제:', userId);
    
    return NextResponse.json({
      success: true,
      message: '알림 스케줄이 삭제되었습니다.'
    });
    
  } catch (error) {
    console.error('❌ 스케줄 삭제 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

