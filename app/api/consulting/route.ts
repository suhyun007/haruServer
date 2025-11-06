import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuth, JWT } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';
import { supabase } from '@/lib/supabase';

const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/generative-language';
const MODEL_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent';

const STYLE_INSTRUCTION = `You are a friendly diet and fitness consultant for HaruFit app.
**CRITICAL RULE: Match the user's language EXACTLY. If user writes in English, reply ONLY in English. If 한국어, reply ONLY in 한국어.**

You help users with:
- Weight management and diet planning
- Exercise recommendations
- Nutrition and meal planning
- Motivation and encouragement
- Personalized diet advice based on their profile

Keep responses SHORT (2-3 sentences), casual, friendly, and encouraging. Use emojis sparingly (1-2 per response).
Be supportive, realistic, and focused on healthy, sustainable weight management.`;

async function getAccessToken() {
  // Priority 1: Environment variable (for Vercel/production)
  const inlineJson = process.env.GOOGLE_CHAT_SERVICE_ACCOUNT_JSON || process.env.SERVICE_ACCOUNT_JSON;
  if (inlineJson) {
    const { client_email, private_key } = JSON.parse(inlineJson as string);
    const client = new JWT({ email: client_email, key: private_key, scopes: [GOOGLE_SCOPE] });
    const { token } = await client.getAccessToken();
    if (!token) throw new Error('Failed to acquire access token');
    return token as string;
  }

  // Priority 2: Local file (for development only)
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const jsonPath = path.join(homeDir, 'Downloads', 'harufit-38f94-f0ada24a18fc.json');
  
  if (fs.existsSync(jsonPath)) {
    const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
    const { client_email, private_key } = JSON.parse(jsonContent);
    const client = new JWT({ email: client_email, key: private_key, scopes: [GOOGLE_SCOPE] });
    const { token } = await client.getAccessToken();
    if (!token) throw new Error('Failed to acquire access token');
    return token as string;
  }

  throw new Error('Service account credentials not found. Set GOOGLE_CHAT_SERVICE_ACCOUNT_JSON env var in Vercel.');
}

async function callGoogleAI(message: string, userContext?: string) {
  const accessToken = await getAccessToken();
  
  const prompt = userContext 
    ? `${userContext}\n\nUser message: ${message}`
    : message;

  const res = await fetch(MODEL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: STYLE_INSTRUCTION },
            { text: prompt },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[consulting POST] Gemini error:', text);
    throw new Error(`Gemini API error: ${text}`);
  }

  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return text;
}

function buildUserContext(user: any): string {
  const nickname = user.nickname || '회원님';
  const startWeight = user.start_weight;
  const currentWeight = user.current_weight;
  const targetWeight = user.target_weight;
  const dietMethodName = user.dietMethod?.name || 'diet';
  const dietStartDate = user.diet_start_date;
  const dailyCalorieGoal = user.daily_calorie_goal || 2000;
  
  let daysSinceStart = 0;
  if (dietStartDate) {
    const startDate = new Date(dietStartDate);
    const today = new Date();
    daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  const weightToLose = currentWeight && targetWeight 
    ? (currentWeight - targetWeight).toFixed(1) 
    : null;

  return `User profile:
- Nickname: ${nickname}
- Diet method: ${dietMethodName}
- Start weight: ${startWeight}kg
- Current weight: ${currentWeight}kg
- Target weight: ${targetWeight}kg
- Weight to lose: ${weightToLose}kg
- Days since starting: ${daysSinceStart} days
- Daily calorie goal: ${dailyCalorieGoal}kcal`;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, message, chatHistory } = body;

    if (!userId || !message) {
      return NextResponse.json(
        { error: 'userId and message are required' },
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    console.log('💬 POST /api/consulting - 상담 요청:', {
      userId,
      message: message.substring(0, 50) + '...',
      chatHistoryLength: chatHistory?.length || 0
    });

    const { data: user, error: userError } = await supabase
      .from('haru_users')
      .select(`
        *,
        dietMethod:haru_diet_methods(*)
      `)
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('사용자 조회 오류:', userError);
      return NextResponse.json(
        { error: 'User not found' },
        { 
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const userContext = buildUserContext(user);
    const aiResponse = await callGoogleAI(message, userContext);

    console.log('✅ 상담 응답 생성 완료');

    return NextResponse.json({
      response: aiResponse
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error: any) {
    console.error('상담 처리 오류:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

