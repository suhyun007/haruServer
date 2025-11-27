import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuth, JWT } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';
import { supabase } from '@/lib/supabase';

const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/generative-language';
const MODEL_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent';

const STYLE_INSTRUCTION = `You are a friendly diet and fitness consultant for HaruFit app.

**CRITICAL LANGUAGE RULE: You MUST reply in the EXACT SAME LANGUAGE as the user's message.**
- If the user writes in English, reply ONLY in English.
- If the user writes in Korean (한국어), reply ONLY in Korean.
- If the user writes in Japanese, reply ONLY in Japanese.
- If the user writes in Chinese, reply ONLY in Chinese.
- If the user writes in French, reply ONLY in French.
- NEVER mix languages. NEVER translate the user's language preference.

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

// Detect language from message text ONLY - DO NOT use app locale or user location
// This function analyzes the actual message content to determine the language
function detectLanguage(message: string): string {
  const trimmed = message.trim();
  if (trimmed.length === 0) return 'English';
  
  // Count characters by language
  const koreanRegex = /[가-힣]/g;
  const japaneseRegex = /[ひらがなカタカナ一-龯]/g;
  const chineseRegex = /[一-龯]/g;
  const frenchRegex = /[àâäéèêëïîôùûüÿç]/gi;
  
  const koreanMatches = (trimmed.match(koreanRegex) || []).length;
  const japaneseMatches = (trimmed.match(japaneseRegex) || []).length;
  const chineseMatches = (trimmed.match(chineseRegex) || []).length;
  const frenchMatches = (trimmed.match(frenchRegex) || []).length;
  
  // Calculate percentages
  const totalChars = trimmed.length;
  const koreanPercent = koreanMatches / totalChars;
  const japanesePercent = japaneseMatches / totalChars;
  const chinesePercent = chineseMatches / totalChars;
  const frenchPercent = frenchMatches / totalChars;
  
  // Determine language based on character presence (more accurate)
  // If any Korean characters exist, it's Korean
  if (koreanMatches > 0) return 'Korean';
  // If any Japanese characters exist, it's Japanese
  if (japaneseMatches > 0) return 'Japanese';
  // If any Chinese characters exist, it's Chinese
  if (chineseMatches > 0) return 'Chinese';
  // If French-specific characters exist with significant presence, it's French
  if (frenchMatches > 0 && frenchPercent > 0.1) return 'French';
  
  // Default to English for all other cases
  return 'English';
}

async function callGoogleAI(message: string, userContext: string | undefined, accessToken: string) {
  const detectedLang = detectLanguage(message);
  
  // Build the full prompt with explicit language matching instruction (simplified for speed)
  const languageInstruction = `\n\nCRITICAL: Reply ONLY in ${detectedLang}. User wrote in ${detectedLang} - match it exactly. Ignore Korean in user profile.\n\n`;
  
  const fullPrompt = userContext 
    ? `${STYLE_INSTRUCTION}${languageInstruction}${userContext}\n\nUser message (reply in ${detectedLang}): ${message}`
    : `${STYLE_INSTRUCTION}${languageInstruction}User message (reply in ${detectedLang}): ${message}`;

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
            { text: fullPrompt },
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
  const nickname = user.nickname || 'User';
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

  // Use English for user context to avoid language bias
  return `User profile (use this information but respond in the user's language):
- Nickname: ${nickname}
- Diet method: ${dietMethodName}
- Start weight: ${startWeight} kg
- Current weight: ${currentWeight} kg
- Target weight: ${targetWeight} kg
- Weight to lose: ${weightToLose} kg
- Days since starting: ${daysSinceStart} days
- Daily calorie goal: ${dailyCalorieGoal} kcal`;
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

    const startTime = Date.now();

    // 사용자 정보 조회와 Access Token 획득을 병렬 처리
    const [userResult, accessToken] = await Promise.all([
      supabase
        .from('haru_users')
        .select(`
          *,
          dietMethod:haru_diet_methods(*)
        `)
        .eq('id', userId)
        .single(),
      getAccessToken().catch(() => null)
    ]);

    const { data: user, error: userError } = userResult;

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

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Failed to get access token' },
        { 
          status: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const userContext = buildUserContext(user);
    const aiResponse = await callGoogleAI(message, userContext, accessToken);
    
    const endTime = Date.now();
    console.log(`⏱️ 총 응답 시간: ${endTime - startTime}ms`);

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

