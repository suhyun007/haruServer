import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const SUPPORTED_LANGS = new Set(['kr', 'jp', 'zh', 'us', 'au', 'ca', 'fr'])

export async function GET(
  request: NextRequest,
  context: { params: { lang: string } }
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

  // 큰 파일만 JSON 제공
  const largeFiles = new Set(['us', 'fr', 'kr', 'jp'])
  if (!largeFiles.has(lang)) {
    return NextResponse.json(
      { error: 'This language uses SQLite format' },
      { status: 404 }
    )
  }

  try {
    // Supabase Storage에서 JSON 파일 목록 가져오기
    const { data: files, error: listError } = await supabase.storage
      .from('food-json')
      .list(`${lang}`, {
        limit: 100,
        sortBy: { column: 'name', order: 'asc' }
      })

    if (listError) {
      console.error('Failed to list files:', listError)
      return NextResponse.json(
        { error: 'Failed to list files', details: listError.message },
        { status: 500 }
      )
    }

    const langFiles = (files || [])
      .filter(f => 
        f.name.startsWith(`${lang}.json.gz`) || 
        (f.name.startsWith(`${lang}_part`) && f.name.endsWith('.json.gz'))
      )
      .sort((a, b) => a.name.localeCompare(b.name))

    if (langFiles.length === 0) {
      return NextResponse.json(
        { error: 'JSON files not found' },
        { status: 404 }
      )
    }

    // 파트 번호 파라미터 확인
    const searchParams = request.nextUrl.searchParams
    const part = searchParams.get('part')

    if (part) {
      // 특정 파트만 반환
      const partNum = parseInt(part, 10)
      let partFile: typeof langFiles[0] | undefined
      
      if (partNum === 1 && langFiles.length > 0) {
        // 첫 번째 파트: part1이거나 단일 파일
        partFile = langFiles.find(f => f.name === `${lang}.json.gz`) || 
                   langFiles.find(f => f.name === `${lang}_part1.json.gz`) ||
                   langFiles[0]
      } else {
        // 나머지 파트: partN 형식
        partFile = langFiles.find(f => f.name.includes(`_part${partNum}.json.gz`))
      }
      
      if (!partFile) {
        return NextResponse.json(
          { error: 'Part not found' },
          { status: 404 }
        )
      }

      // Supabase Storage에서 파일 다운로드
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('food-json')
        .download(`${lang}/${partFile.name}`)

      if (downloadError || !fileData) {
        console.error('Failed to download file:', downloadError)
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
          'Content-Disposition': `attachment; filename="${partFile.name}"`,
          'Cache-Control': 'public, max-age=86400',
          'Last-Modified': new Date(partFile.updated_at || partFile.created_at || Date.now()).toUTCString(),
          'ETag': `"${partFile.id || partFile.name}"`,
        },
      })
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
  } catch (error: any) {
    console.error('Failed to read JSON files:', error)
    return NextResponse.json(
      { error: 'Failed to read files', details: error.message },
      { status: 500 }
    )
  }
}

