import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const SUPPORTED_LANGS = new Set(['kr', 'jp', 'zh', 'us', 'au', 'ca', 'fr'])
const DATA_DIR = path.join(process.cwd(), 'data', 'foodData')
const JSON_DIR = path.join(DATA_DIR, 'json')

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
  const largeFiles = new Set(['us', 'fr', 'kr'])
  if (!largeFiles.has(lang)) {
    return NextResponse.json(
      { error: 'This language uses SQLite format' },
      { status: 404 }
    )
  }

  try {
    // JSON 파일 목록 가져오기
    const files = await fs.readdir(JSON_DIR)
    const langFiles = files
      .filter(f => 
        f.startsWith(`${lang}.json.gz`) || 
        (f.startsWith(`${lang}_part`) && f.endsWith('.json.gz'))
      )
      .sort()

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
      let partFile: string | undefined
      
      if (partNum === 1 && langFiles.length > 0) {
        // 첫 번째 파트: part1이거나 단일 파일
        partFile = langFiles.find(f => f === `${lang}.json.gz`) || 
                   langFiles.find(f => f === `${lang}_part1.json.gz`) ||
                   langFiles[0]
      } else {
        // 나머지 파트: partN 형식
        partFile = langFiles.find(f => f.includes(`_part${partNum}.json.gz`))
      }
      
      if (!partFile) {
        return NextResponse.json(
          { error: 'Part not found' },
          { status: 404 }
        )
      }

      const filePath = path.join(JSON_DIR, partFile)
      const file = await fs.readFile(filePath)
      const stats = await fs.stat(filePath)

      return new NextResponse(file, {
        headers: {
          'Content-Type': 'application/gzip',
          'Content-Disposition': `attachment; filename="${partFile}"`,
          'Cache-Control': 'public, max-age=86400',
          'Last-Modified': stats.mtime.toUTCString(),
          'ETag': `"${stats.mtime.getTime()}-${stats.size}"`,
        },
      })
    }

    // 모든 파트 정보 반환
    const parts = await Promise.all(
      langFiles.map(async (fileName) => {
        const filePath = path.join(JSON_DIR, fileName)
        const stats = await fs.stat(filePath)
        return {
          fileName,
          size: stats.size,
          modifiedAt: stats.mtime.toISOString(),
          modifiedTimestamp: stats.mtime.getTime(),
        }
      })
    )

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

