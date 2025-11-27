import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const SUPPORTED_LANGS = new Set(['kr', 'jp', 'zh', 'us', 'au', 'ca', 'fr'])

export async function GET(
  _request: NextRequest,
  context: { params: { lang: string; part: string } }
) {
  let lang = context.params.lang?.toLowerCase()

  if (lang === 'en') {
    lang = 'us'
  }

  if (!lang || !SUPPORTED_LANGS.has(lang)) {
    return NextResponse.json(
      { error: 'Unsupported language' },
      { status: 400 }
    )
  }

  const partNum = parseInt(context.params.part, 10)
  if (isNaN(partNum) || partNum < 1) {
    return NextResponse.json(
      { error: 'Invalid part number' },
      { status: 400 }
    )
  }

  // 실제 파일 구조: 루트에 foods_us_chunk1.part.gz 파일들이 있음
  const storageLang = lang === 'us' ? 'en' : lang
  const folderPath = `chunks/${storageLang}` // 폴더 경로 (있을 수도)
  const chunkFileName = `foods_${lang}_chunk${partNum}.part.gz`
  
  // 실제 파일은 루트에 있음!
  const chunkPathRoot = chunkFileName // 루트: foods_us_chunk1.part.gz
  const chunkPathInFolder = `${folderPath}/${chunkFileName}` // 폴더: chunks/en/foods_us_chunk1.part.gz

  console.log('🔍 Looking for chunk file:', {
    lang,
    storageLang,
    chunkFileName,
    bucket: 'food-json',
  })

  try {
    // 실제 파일은 en/ 폴더에 있음 (서버 로그에서 확인됨)
    // en/foods_us_chunk1.part.gz 경로를 먼저 시도
    const actualChunkPath = `${storageLang}/${chunkFileName}` // en/foods_us_chunk1.part.gz
    
    console.log(`📥 Downloading chunk from: ${actualChunkPath}`)
    
    // Supabase Storage에서 청크 파일 다운로드
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('food-json')
      .download(actualChunkPath)

    if (downloadError || !fileData) {
      console.error('❌ Failed to download chunk:', {
        path: actualChunkPath,
        error: downloadError,
      })
      
      // 다른 가능한 경로들도 시도
      const fallbackPaths = [
        chunkPathRoot, // 루트: foods_us_chunk1.part.gz
        chunkPathInFolder, // chunks/en/foods_us_chunk1.part.gz
        `foods_${storageLang}_chunk${partNum}.part.gz`, // foods_en_chunk1.part.gz
      ]
      
      let found = false
      for (const fallbackPath of fallbackPaths) {
        console.log(`🔍 Trying fallback path: ${fallbackPath}`)
        const { data, error } = await supabase.storage
          .from('food-json')
          .download(fallbackPath)
        
        if (!error && data) {
          console.log(`✅ Found at fallback path: ${fallbackPath}`)
          return new NextResponse(data, {
            headers: {
              'Content-Type': 'application/gzip',
              'Content-Disposition': `attachment; filename="${chunkFileName}"`,
            },
          })
        }
      }
      
      // 루트 폴더 목록 확인 (디버깅용)
      const { data: rootFiles } = await supabase.storage
        .from('food-json')
        .list('', { limit: 100 })
      const chunkFilesInRoot = rootFiles?.filter(f => f.name?.includes('chunk')).map(f => f.name) || []
      
      // en 폴더 목록 확인
      const { data: enFiles } = await supabase.storage
        .from('food-json')
        .list(storageLang, { limit: 100 })
      const chunkFilesInEn = enFiles?.filter(f => f.name?.includes('chunk')).map(f => f.name) || []
      
      console.error('❌ All paths failed. Available files:')
      console.error('   Root:', chunkFilesInRoot)
      console.error(`   ${storageLang}/:`, chunkFilesInEn)
      
      return NextResponse.json({ 
        error: 'Chunk not found',
        details: {
          triedPath: actualChunkPath,
          fallbackPaths,
          availableInRoot: chunkFilesInRoot,
          availableInEn: chunkFilesInEn,
        }
      }, { status: 404 })
    }
    
    // 파일 메타데이터 가져오기 (en 폴더에서 찾기)
    const { data: fileList } = await supabase.storage
      .from('food-json')
      .list(storageLang, {
        search: chunkFileName
      })

    const fileInfo = fileList && fileList.length > 0 ? fileList[0] : null
    const updatedAt = fileInfo?.updated_at || fileInfo?.created_at || new Date().toISOString()
    const fileSize = fileInfo?.metadata?.size || (fileData ? fileData.size : 0)

    // ArrayBuffer를 Buffer로 변환
    const arrayBuffer = await fileData.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    console.log(`✅ Returning chunk file: ${chunkFileName} (${fileSize} bytes)`)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${chunkFileName}"`,
        'Cache-Control': 'public, max-age=86400',
        'Last-Modified': new Date(updatedAt).toUTCString(),
        'ETag': `"${new Date(updatedAt).getTime()}-${fileSize}"`,
      },
    })
  } catch (error) {
    console.error('Failed to read chunk file:', error)
    return NextResponse.json(
      { error: 'Failed to read chunk' },
      { status: 500 }
    )
  }
}

