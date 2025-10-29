import { NextRequest, NextResponse } from 'next/server';

const ONE_SIGNAL_APP_ID = "06a563c7-bd9e-4c70-bd17-5920cbf7b00c";
const ONE_SIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const { playerId, time, userId, timezone, timezoneOffset: userTimezoneOffset } = await request.json();

    if (!playerId) {
      return NextResponse.json(
        { error: "playerId가 필요합니다." },
        { status: 400 }
      );
    }

    if (!ONE_SIGNAL_API_KEY) {
      return NextResponse.json(
        { error: "OneSignal API Key가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    // 시간 파싱 (HH:MM 형식)
    const [hour, minute] = time.split(':').map(Number);
    
    // 사용자 시간대를 고려한 알림 시간 계산
    const userTimezone = timezone || 'Asia/Seoul'; // 기본값: 한국 시간
    const timezoneOffset = userTimezoneOffset || 540; // 기본값: UTC+9 (한국)
    
    // 현재 UTC 시간
    const now = new Date();
    
    // 사용자 시간대의 현재 시간 계산
    const userNow = new Date(now.getTime() + (timezoneOffset * 60000));
    
    // 사용자 시간대의 알림 시간 (오늘)
    const notificationTime = new Date(userNow);
    notificationTime.setHours(hour, minute, 0, 0);
    
    // 이미 오늘 알림 시간이 지났으면 내일로 설정
    if (notificationTime <= userNow) {
      notificationTime.setDate(notificationTime.getDate() + 1);
    }
    
    // UTC로 변환하여 OneSignal에 전송
    const utcNotificationTime = new Date(notificationTime.getTime() - (timezoneOffset * 60000));

    // 매일 반복 알림을 위해 cron job 방식으로 구현
    // 현재는 즉시 알림을 보내고, 실제 매일 반복은 별도 cron job에서 처리
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${ONE_SIGNAL_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        app_id: ONE_SIGNAL_APP_ID,
        include_player_ids: [playerId],
        headings: { "en": "⚖️ 체중 기록 시간!" },
        contents: { "en": "오늘의 체중을 기록하고 변화를 확인해보세요." },
        // 즉시 전송 (테스트용)
        // send_after: utcNotificationTime.toISOString(),
        // 태그로 사용자 정보 저장 (배열 형식)
        tags: [
          { key: "user_id", relation: "=", value: userId },
          { key: "notification_type", relation: "=", value: "daily_weight_reminder" },
          { key: "scheduled_time", relation: "=", value: time }
        ]
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error("OneSignal 스케줄링 오류:", data);
      return NextResponse.json(
        { success: false, error: data },
        { status: response.status }
      );
    }

    return NextResponse.json({ 
      success: true, 
      data,
      scheduledTime: utcNotificationTime.toISOString(),
      userTimezone: userTimezone,
      localTime: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
    });
  } catch (error) {
    console.error("일일 알림 스케줄링 오류:", error);
    return NextResponse.json(
      { success: false, error: "알림 스케줄링 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
