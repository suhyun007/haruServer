import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const SUPPORTED_LANGS = new Set(['kr', 'jp', 'zh', 'us', 'au', 'ca', 'fr'])
const DATA_DIR = path.join(process.cwd(), 'data', 'foodData')

export async function GET(
  _request: NextRequest,
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

  // 큰 파일(en, fr, kr)은 JSON+gzip으로 변환되었으므로 SQLite 파일이 없을 수 있음
  // 작은 파일(au, ca, jp)만 SQLite로 제공
  const largeFiles = new Set(['us', 'fr', 'kr'])
  
  if (largeFiles.has(lang)) {
    // 큰 파일은 JSON+gzip으로 변환되었으므로 SQLite 다운로드 불가
    return NextResponse.json(
      { 
        error: 'This language uses JSON format. Please use /api/food-search/[lang] endpoint instead.',
        message: 'Large files (en, fr, kr) have been converted to JSON+gzip format for better performance.'
      },
      { status: 404 }
    )
  }

  const filePath = path.join(DATA_DIR, `foods_${lang}.sqlite`)

  try {
    await fs.access(filePath)
  } catch (error) {
    console.error('SQLite file not found:', filePath, error)
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  try {
    const file = await fs.readFile(filePath)
    const stats = await fs.stat(filePath)
    return new NextResponse(file, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="foods_${lang}.sqlite"`,
        'Cache-Control': 'public, max-age=86400',
        'Last-Modified': stats.mtime.toUTCString(),
        'ETag': `"${stats.mtime.getTime()}-${stats.size}"`,
      },
    })
  } catch (error) {
    console.error('Failed to read SQLite file:', error)
    return NextResponse.json(
      { error: 'Failed to read file' },
      { status: 500 }
    )
  }
}

