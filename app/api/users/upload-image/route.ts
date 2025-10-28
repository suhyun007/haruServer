import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string;

    if (!file || !userId) {
      return NextResponse.json(
        { error: 'File and userId are required' },
        { status: 400 }
      );
    }

    // 이미지를 버퍼로 변환
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 파일명 생성: profile_userId.jpg (고정 파일명으로 덮어쓰기)
    const fileName = `profile_${userId}.jpg`;
    const filePath = `profiles/${fileName}`;

    // Supabase Storage에 업로드 (upsert: true로 덮어쓰기)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('harufit-images')
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload image', details: uploadError.message },
        { status: 500 }
      );
    }

    // Public URL 생성 (Transform을 사용한 200x200 리사이즈)
    const { data: publicUrlData } = supabase.storage
      .from('harufit-images')
      .getPublicUrl(filePath, {
        transform: {
          width: 200,
          height: 200,
          resize: 'cover',
        },
      });

    const imageUrl = publicUrlData.publicUrl;

    // haru_users 테이블에 profileImageUrl 업데이트
    const { error: updateError } = await supabase
      .from('haru_users')
      .update({ profile_image_url: imageUrl })
      .eq('id', userId);

    if (updateError) {
      console.error('Database update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update user profile', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      imageUrl: imageUrl,
      message: 'Profile image uploaded successfully',
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

