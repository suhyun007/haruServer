import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const SUPPORTED_LANGS = new Set(['kr', 'jp', 'zh', 'us', 'au', 'ca', 'fr'])

export async function GET(
  request: NextRequest,
  context: { params: { lang: string } }
) {
  let lang = context.params.lang?.toLowerCase()

  // Supabase Storage 구조: en(미국), kr(한국), jp(일본), fr(프랑스), au(호주), ca(캐나다)
  // 클라이언트는 us를 보낼 수 있으므로 en으로 변환
  let storageLang = lang
  if (lang === 'us' || lang === 'en') {
    storageLang = 'en' // Supabase에는 en으로 저장됨
    lang = 'us' // 내부적으로는 us로 유지
  }
  // au, ca는 그대로 사용

  if (!lang || !SUPPORTED_LANGS.has(lang)) {
    return NextResponse.json(
      { error: 'Unsupported language' },
      { status: 400 }
    )
  }

  // 큰 파일만 JSON 제공
  const largeFiles = new Set(['us', 'fr', 'kr', 'jp', 'au', 'ca'])
  if (!largeFiles.has(lang)) {
    return NextResponse.json(
      { error: 'This language uses SQLite format' },
      { status: 404 }
    )
  }

  try {
    // 파트 다운로드 요청인 경우 파일 목록 조회 생략 (이미 클라이언트가 알고 있음)
    const searchParams = request.nextUrl.searchParams
    const part = searchParams.get('part')
    
    // 파트 다운로드가 아닌 경우에만 파일 목록 조회
    if (!part) {
      // Supabase Storage에서 JSON 파일 목록 가져오기
      // storageLang: en, kr, jp, fr (실제 저장된 폴더명)
      const folderPath = `${storageLang}`
      console.log(`📂 Listing files for ${lang} (searching in "${folderPath}" folder) in food-json bucket...`)
      
      const { data: files, error: listError } = await supabase.storage
        .from('food-json')
        .list(folderPath, {
          limit: 100,
          sortBy: { column: 'name', order: 'asc' }
        })

      if (listError) {
        console.error('❌ Failed to list files:', listError)
        return NextResponse.json(
          { error: 'Failed to list files', details: listError.message },
          { status: 500 }
        )
      }
      
      console.log(`✅ Found ${files?.length || 0} files for ${lang}`)

      // 파일명 필터링: storageLang 사용 (en, kr, jp, fr)
      const langFiles = (files || [])
        .filter(f => 
          f.name.startsWith(`${storageLang}.json.gz`) || 
          (f.name.startsWith(`${storageLang}_part`) && f.name.endsWith('.json.gz'))
        )
        .sort((a, b) => a.name.localeCompare(b.name))

      if (langFiles.length === 0) {
        return NextResponse.json(
          { error: 'JSON files not found' },
          { status: 404 }
        )
      }

      // 모든 파트 정보 반환
      const parts = langFiles.map((file) => {
        const updatedAt = file.updated_at || file.created_at || new Date().toISOString()
        return {
          fileName: file.name,
          size: file.metadata?.size || 0,
          modifiedAt: updatedAt,
          modifiedTimestamp: new Date(updatedAt).getTime(),
        }
      })

      return NextResponse.json({
        lang,
        parts,
        totalParts: parts.length,
      })
    }

    // 파트 다운로드 요청 처리
    // 파일 목록을 다시 조회하지 않고 직접 파일 다운로드
    const partNum = parseInt(part!, 10)
    const folderPath = `${storageLang}`
    
    // 파일명 생성 (part 번호로 직접 구성)
    let fileName: string
    if (partNum === 1) {
      // 첫 번째 파트: en.json.gz 또는 en_part1.json.gz
      fileName = `${storageLang}.json.gz`
    } else {
      // 나머지 파트: en_partN.json.gz
      fileName = `${storageLang}_part${partNum}.json.gz`
    }
    
    const downloadPath = `${folderPath}/${fileName}`
    console.log(`📥 Downloading part ${partNum}: ${downloadPath}`)
    
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('food-json')
      .download(downloadPath)

    if (downloadError || !fileData) {
      console.error('❌ Failed to download file:', downloadError)
      // part1이 실패하면 part1.json.gz 시도
      if (partNum === 1) {
        const altFileName = `${storageLang}_part1.json.gz`
        const altPath = `${folderPath}/${altFileName}`
        console.log(`🔄 Trying alternative: ${altPath}`)
        const { data: altFileData, error: altError } = await supabase.storage
          .from('food-json')
          .download(altPath)
        
        if (altError || !altFileData) {
          return NextResponse.json(
            { error: 'Failed to download file', details: altError?.message || downloadError?.message },
            { status: 500 }
          )
        }
        
        const arrayBuffer = await altFileData.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': 'application/gzip',
            'Content-Disposition': `attachment; filename="${altFileName}"`,
            'Cache-Control': 'public, max-age=86400',
          },
        })
      }
      
      return NextResponse.json(
        { error: 'Failed to download file', details: downloadError?.message },
        { status: 500 }
      )
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (error: any) {
    console.error('Failed to read JSON files:', error)
    return NextResponse.json(
      { error: 'Failed to read files', details: error.message },
      { status: 500 }
    )
  }
}

