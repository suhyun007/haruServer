import { NextRequest, NextResponse } from 'next/server';

const ONE_SIGNAL_APP_ID = "06a563c7-bd9e-4c70-bd17-5920cbf7b00c";
const ONE_SIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY || "YOUR_ONESIGNAL_API_KEY_HERE";

export async function POST(request: NextRequest) {
  try {
    const { title, message, playerId } = await request.json();

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

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${ONE_SIGNAL_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        app_id: ONE_SIGNAL_APP_ID,
        include_player_ids: [playerId],
        headings: { "en": title ?? "HaruFit 알림" },
        contents: { "en": message ?? "서버에서 보낸 푸시입니다 🚀" },
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error("OneSignal API 오류:", data);
      return NextResponse.json(
        { success: false, error: data },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("푸시 전송 오류:", error);
    return NextResponse.json(
      { success: false, error: "푸시 전송 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
