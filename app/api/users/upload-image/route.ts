import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import sharp from 'sharp';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string;
    const socialId = formData.get('socialId') as string;

    if (!file || (!userId && !socialId)) {
      return NextResponse.json(
        { error: 'File and userId or socialId are required' },
        { status: 400 }
      );
    }

    // 실제 사용자 ID 찾기
    let actualUserId = userId;
    
    if (socialId) {
      // SNS 로그인 사용자: social_id로 id 조회
      const { data: userData, error: userError } = await supabase
        .from('haru_users')
        .select('id')
        .eq('social_id', socialId)
        .single();

      if (userError || !userData) {
        console.error('User not found by social_id:', userError);
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
      
      actualUserId = userData.id;
      console.log('SNS 로그인 사용자 ID 조회:', actualUserId);
    } else {
      console.log('일반 로그인 사용자 ID 사용:', actualUserId);
    }

    // 이미지를 버퍼로 변환
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    console.log('이미지 파일 정보:', {
      name: file.name,
      type: file.type,
      size: file.size,
      bufferLength: buffer.length
    });

    let resizedBuffer: Buffer;

    try {
      // Sharp를 사용하여 이미지 리사이징 (200x200, cover)
      resizedBuffer = await sharp(buffer)
        .resize(200, 200, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 80 })
        .toBuffer();
      
      console.log('Sharp 리사이징 성공');
    } catch (sharpError) {
      console.error('Sharp 리사이징 실패:', sharpError);
      
      // Sharp 실패 시 원본 이미지를 그대로 사용 (JPEG로 변환 시도)
      try {
        resizedBuffer = await sharp(buffer)
          .jpeg({ quality: 80 })
          .toBuffer();
        console.log('JPEG 변환 성공');
      } catch (jpegError) {
        console.error('JPEG 변환도 실패:', jpegError);
        
        // 모든 변환 실패 시 원본 버퍼 사용
        console.log('원본 버퍼 사용');
        resizedBuffer = buffer;
      }
    }

    // 파일명 생성: profile_actualUserId.jpg (고정 파일명으로 덮어쓰기)
    const fileName = `profile_${actualUserId}.jpg`;
    const filePath = `profiles/${fileName}`;

    // Supabase Storage에 리사이징된 이미지 업로드 (upsert: true로 덮어쓰기)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('harufit-images')
      .upload(filePath, resizedBuffer, {
        contentType: 'image/jpeg',
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

    // Public URL 생성 (원본 이미지 URL 사용)
    const { data: publicUrlData } = supabase.storage
      .from('harufit-images')
      .getPublicUrl(filePath);

    const imageUrl = publicUrlData.publicUrl;

    // haru_users 테이블에 profileImageUrl 업데이트
    const { error: updateError } = await supabase
      .from('haru_users')
      .update({ profile_image_url: imageUrl })
      .eq('id', actualUserId);

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

