import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const ONE_SIGNAL_APP_ID = "06a563c7-bd9e-4c70-bd17-5920cbf7b00c";
const ONE_SIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

export async function GET(request: NextRequest) {
  try {
    if (!ONE_SIGNAL_API_KEY) {
      return NextResponse.json(
        { error: "OneSignal API Key가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    // 현재 UTC 시간
    const now = new Date();
    console.log(`🕐 현재 UTC 시간: ${now.toISOString()}`);

    // 알림이 활성화된 사용자들 조회
    const { data: users, error } = await supabase
      .from('haru_users')
      .select('id, notification_enabled, notification_time, timezone')
      .eq('notification_enabled', true);

    if (error) {
      console.error('사용자 조회 오류:', error);
      return NextResponse.json(
        { error: "사용자 조회 실패" },
        { status: 500 }
      );
    }

    if (!users || users.length === 0) {
      console.log('📭 알림이 활성화된 사용자가 없습니다.');
      return NextResponse.json({ 
        success: true, 
        message: "알림이 활성화된 사용자가 없습니다.",
        currentTime: now.toISOString()
      });
    }

    // 각 사용자의 시간대에 맞는 현재 시간 계산
    const targetUsers = [];
    
    for (const user of users) {
      try {
        // 사용자의 시간대에 맞는 현재 시간 계산
        const userTimezone = user.timezone || 'Asia/Seoul';
        const userTime = new Date(now.toLocaleString("en-US", {timeZone: userTimezone}));
        const userCurrentTime = `${userTime.getHours().toString().padStart(2, '0')}:${userTime.getMinutes().toString().padStart(2, '0')}`;
        
        console.log(`👤 사용자 ${user.id} (${userTimezone}): ${userCurrentTime} vs 설정시간: ${user.notification_time}`);
        
        if (user.notification_time === userCurrentTime) {
          targetUsers.push({...user, userCurrentTime});
        }
      } catch (error) {
        console.error(`사용자 ${user.id} 시간대 계산 오류:`, error);
      }
    }
    
    console.log(`👥 알림 대상 사용자: ${targetUsers.length}명`);

    if (targetUsers.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: `현재 시간에 알림을 받을 사용자가 없습니다.`,
        currentTime: now.toISOString()
      });
    }

    // 각 사용자에게 알림 전송
    const results = [];
    for (const user of targetUsers) {
      try {
        // OneSignal에서 사용자 ID로 플레이어 ID 조회
        const playerResponse = await fetch(`https://onesignal.com/api/v1/players?app_id=${ONE_SIGNAL_APP_ID}&tag=user_id:${user.id}`, {
          method: "GET",
          headers: {
            "Authorization": `Basic ${ONE_SIGNAL_API_KEY}`,
            "Content-Type": "application/json"
          }
        });

        if (!playerResponse.ok) {
          console.error(`사용자 ${user.id}의 플레이어 ID 조회 실패`);
          continue;
        }

        const playerData = await playerResponse.json();
        if (!playerData.players || playerData.players.length === 0) {
          console.error(`사용자 ${user.id}의 플레이어 ID가 없습니다.`);
          continue;
        }

        const playerId = playerData.players[0].id;

        // 알림 전송
        const notificationResponse = await fetch("https://onesignal.com/api/v1/notifications", {
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
            data: {
              type: "daily_weight_reminder",
              time: user.notification_time
            }
          }),
        });

        const notificationData = await notificationResponse.json();
        
        if (notificationResponse.ok) {
          console.log(`✅ 사용자 ${user.id}에게 알림 전송 성공`);
          results.push({ userId: user.id, success: true });
        } else {
          console.error(`❌ 사용자 ${user.id}에게 알림 전송 실패:`, notificationData);
          results.push({ userId: user.id, success: false, error: notificationData });
        }
      } catch (error) {
        console.error(`사용자 ${user.id} 알림 전송 오류:`, error);
        results.push({ userId: user.id, success: false, error: error instanceof Error ? error.message : String(error) });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `${results.length}명의 사용자에게 알림 전송 완료`,
      currentTime: now.toISOString(),
      results 
    });

  } catch (error) {
    console.error("일일 알림 전송 오류:", error);
    return NextResponse.json(
      { error: "알림 전송 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
