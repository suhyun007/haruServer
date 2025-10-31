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

    // 이미지를 버퍼로 변환 (ArrayBufferLike → Uint8Array → Buffer)
    const buffer = Buffer.from(new Uint8Array(await file.arrayBuffer()));

    console.log('이미지 파일 정보:', {
      name: file.name,
      type: file.type,
      size: file.size,
      bufferLength: buffer.length
    });

    let resizedBuffer: Buffer;

    try {
      // 원본 메타 확인
      const meta = await sharp(buffer).metadata();
      const w = meta.width ?? 0;
      const h = meta.height ?? 0;
      const noMeta = !w || !h; // 메타가 없으면 강제 리사이즈 경로 사용

      let base: Buffer;
      if (noMeta || w > 1000 || h > 1000) {
        base = await sharp(buffer)
          .rotate()
          .resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true })
          .toBuffer();
      } else {
        base = buffer;
      }

      // 메타 없음 또는 80px 초과이면 80x80 cover, 이하면 JPEG 변환만
      if (noMeta || w > 80 || h > 80) {
        resizedBuffer = await sharp(base)
          .resize(80, 80, { fit: 'cover', position: 'center' })
          .jpeg({ quality: 80 })
          .toBuffer();
        console.log('Sharp 썸네일(200x200) 생성, 출력 바이트:', resizedBuffer.length);
      } else {
        resizedBuffer = await sharp(base)
          .rotate()
          .jpeg({ quality: 80 })
          .toBuffer();
        console.log('작은 이미지 JPEG 변환, 출력 바이트:', resizedBuffer.length);
      }
    } catch (sharpError) {
      console.error('Sharp 리사이징 실패:', sharpError);
      
      // Sharp 실패 시 원본 이미지를 그대로 사용 (JPEG로 변환 시도)
      try {
        resizedBuffer = await sharp(buffer)
          .rotate()
          .jpeg({ quality: 80 })
          .toBuffer();
        console.log('JPEG 변환 성공, 출력 바이트:', resizedBuffer.length);
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
        cacheControl: '0',
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
    const nowIso = new Date().toISOString();
    const { data: updatedUser, error: updateError } = await supabase
      .from('haru_users')
      .update({ 
        profile_image_url: imageUrl,
        updated_at: nowIso,
      })
      .eq('id', actualUserId)
      .select('id, updated_at')
      .single();

    if (updateError) {
      console.error('Database update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update user profile', details: updateError.message },
        { status: 500 }
      );
    }
    console.log('프로필 업데이트 완료:', { id: updatedUser?.id, updated_at: updatedUser?.updated_at });

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

